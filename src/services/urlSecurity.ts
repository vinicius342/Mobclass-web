// Serviço avançado de validação de URLs com Google Safe Browsing API

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
  warnings?: string[];
  securityScore?: number; // 0-100, quanto maior, mais seguro
  allowWithWarning?: boolean;
  domainCategory?: 'trusted' | 'educational' | 'unknown' | 'suspicious' | 'blocked';
  safeBrowsingResult?: {
    isSafe: boolean;
    threatTypes?: string[];
    source: 'google' | 'local' | 'cache';
  };
}

export interface SecurityConfig {
  allowHttp: boolean;
  maxUrlLength: number;
  enableExternalValidation: boolean;
  enableSafeBrowsing: boolean;
  logAttempts: boolean;
  rateLimitPerMinute: number;
  cacheExpirationMinutes: number;
}

export class URLSecurityService {
  private static instance: URLSecurityService;
  
  private config: SecurityConfig = {
    allowHttp: false, // Força HTTPS por padrão
    maxUrlLength: 500,
    enableExternalValidation: true,
    enableSafeBrowsing: true,
    logAttempts: true,
    rateLimitPerMinute: 100,
    cacheExpirationMinutes: 30,
  };

  private safeBrowsingCache = new Map<string, { result: boolean; timestamp: number; threatTypes?: string[] }>();
  private rateLimitTracker = new Map<string, number[]>();
  private cache = new Map<string, ValidationResult>();
  private suspiciousAttempts: Array<{ url: string; timestamp: number; userAgent?: string; userIp?: string }> = [];
  private readonly apiKey: string;

  // Domínios totalmente confiáveis - permitir sempre
  private readonly trustedDomains = new Set([
    'googleapis.com',
    'google.com',
    'edu.br',
    'gov.br',
    'wikipedia.org',
    'github.com',
    'stackoverflow.com',
    'mozilla.org',
    'w3.org',
    'microsoft.com',
    'apple.com',
    'youtube.com',
    'vimeo.com',
    'coursera.org',
    'edx.org',
    'khanacademy.org',
    'ted.com',
    'mit.edu',
    'stanford.edu',
    'harvard.edu',
    'unicamp.br',
    'usp.br',
    'ufsc.br',
    'ufmg.br',
    'ufrj.br',
    'puc-rio.br'
  ]);

  // Domínios educacionais - permitir com score alto
  private readonly educationalDomains = new Set([
    '.edu',
    '.edu.br',
    '.ac.uk',
    '.edu.au',
    'classroom.google.com',
    'forms.gle',
    'docs.google.com',
    'drive.google.com',
    'slides.google.com',
    'sheets.google.com'
  ]);

  // Padrões suspeitos na URL
  private readonly suspiciousPatterns = [
    /bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly/i, // Encurtadores genéricos
    /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/i, // IPs diretos
    /phishing|malware|virus|hack|exploit/i, // Palavras suspeitas
    /free[-_]?download|click[-_]?here|urgent/i, // Spam comum
    /[a-z]{20,}/i, // Subdomínios muito longos
    /xn--/i, // Domínios IDN (potencial homograph attack)
    /(paypal|amazon|facebook|google|microsoft).*\.(tk|ml|ga|cf)/i, // Phishing conhecido
  ];

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_SAFE_BROWSING_API_KEY || '';
    if (this.config.enableSafeBrowsing && !this.apiKey) {
      this.config.enableSafeBrowsing = false;
    }
  }

  public static getInstance(): URLSecurityService {
    if (!URLSecurityService.instance) {
      URLSecurityService.instance = new URLSecurityService();
    }
    return URLSecurityService.instance;
  }

  public updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public async validateUrl(url: string, userIp?: string): Promise<ValidationResult> {
    try {
      // Rate limiting
      if (userIp && !this.checkRateLimit(userIp)) {
        return {
          isValid: false,
          error: 'Muitas tentativas de validação. Tente novamente mais tarde.',
          securityScore: 0,
          domainCategory: 'blocked'
        };
      }

      // Verificações básicas
      const basicValidation = this.performBasicValidation(url);
      if (!basicValidation.isValid) {
        return basicValidation;
      }

      const normalizedUrl = this.normalizeUrl(url);
      const domain = this.extractDomain(normalizedUrl);

      // Verificar cache primeiro
      const cacheKey = this.getCacheKey(normalizedUrl);
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Análise local
      const localAnalysis = this.performLocalAnalysis(normalizedUrl, domain);
      
      // Se o domínio é confiável, retornar direto
      if (localAnalysis.domainCategory === 'trusted') {
        const result = {
          isValid: true,
          sanitizedUrl: normalizedUrl,
          securityScore: 95,
          domainCategory: localAnalysis.domainCategory,
          safeBrowsingResult: { isSafe: true, source: 'local' as const }
        };
        this.setCachedResult(cacheKey, result);
        return result;
      }

      // Verificação externa com Google Safe Browsing (se habilitado)
      let safeBrowsingResult;
      if (this.config.enableSafeBrowsing && this.config.enableExternalValidation) {
        safeBrowsingResult = await this.checkGoogleSafeBrowsing(normalizedUrl);
      }

      // Compilar resultado final
      const finalResult = this.compileFinalResult(
        normalizedUrl,
        localAnalysis,
        safeBrowsingResult
      );

      // Cache do resultado
      this.setCachedResult(cacheKey, finalResult);

      // Log da tentativa (se habilitado)
      if (this.config.logAttempts) {
        this.logValidationAttempt(url, finalResult, userIp);
      }

      return finalResult;

    } catch (error) {
      console.error('Erro na validação de URL:', error);
      return {
        isValid: false,
        error: 'Erro interno na validação. Tente novamente.',
        securityScore: 0,
        domainCategory: 'unknown'
      };
    }
  }

  public async validateMultipleUrls(urls: string[], userIp?: string): Promise<ValidationResult[]> {
    // Processa até 10 URLs por vez para evitar sobrecarga
    const batchSize = 10;
    const results: ValidationResult[] = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchPromises = batch.map(url => this.validateUrl(url, userIp));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  private performBasicValidation(url: string): ValidationResult {
    // Verificar se a URL não está vazia
    if (!url || url.trim().length === 0) {
      return {
        isValid: false,
        error: 'URL não pode estar vazia',
        securityScore: 0,
        domainCategory: 'blocked'
      };
    }

    // Verificar comprimento
    if (url.length > this.config.maxUrlLength) {
      return {
        isValid: false,
        error: 'URL muito longa (máximo ' + this.config.maxUrlLength + ' caracteres)',
        securityScore: 0,
        domainCategory: 'blocked'
      };
    }

    // Verificar protocolo
    const normalizedUrl = this.normalizeUrl(url);
    if (!normalizedUrl.startsWith('https://') && !this.config.allowHttp) {
      return {
        isValid: false,
        error: 'Apenas URLs HTTPS são permitidas',
        securityScore: 0,
        domainCategory: 'blocked'
      };
    }

    // Verificar se é uma URL válida
    try {
      new URL(normalizedUrl);
    } catch {
      return {
        isValid: false,
        error: 'Formato de URL inválido',
        securityScore: 0,
        domainCategory: 'blocked'
      };
    }

    return { isValid: true, securityScore: 50, domainCategory: 'unknown' };
  }

  private normalizeUrl(url: string): string {
    let normalized = url.trim().toLowerCase();
    
    // Adicionar protocolo se não existir
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }
    
    // Remover fragmentos e alguns parâmetros suspeitos
    try {
      const urlObj = new URL(normalized);
      
      // Remover parâmetros de tracking comuns
      const suspiciousParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
      suspiciousParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });
      
      // Remover fragmento
      urlObj.hash = '';
      
      return urlObj.toString();
    } catch {
      return normalized;
    }
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  private performLocalAnalysis(url: string, domain: string): {
    securityScore: number;
    domainCategory: ValidationResult['domainCategory'];
    warnings: string[];
  } {
    let securityScore = 70; // Score base
    const warnings: string[] = [];
    let domainCategory: ValidationResult['domainCategory'] = 'unknown';

    // Verificar domínios confiáveis
    const isDirectlyTrusted = this.trustedDomains.has(domain);
    const isTrustedSubdomain = Array.from(this.trustedDomains).some(trusted => 
      domain.endsWith('.' + trusted)
    );

    if (isDirectlyTrusted || isTrustedSubdomain) {
      return {
        securityScore: 95,
        domainCategory: 'trusted',
        warnings: []
      };
    }

    // Verificar domínios educacionais
    const isEducational = Array.from(this.educationalDomains).some(edu => 
      domain.includes(edu) || domain.endsWith(edu)
    );

    if (isEducational) {
      securityScore = 90;
      domainCategory = 'educational';
    }

    // Verificar padrões suspeitos
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(domain)) {
        securityScore -= 25;
        warnings.push('URL contém padrões potencialmente suspeitos');
        
        if (securityScore < 40) {
          domainCategory = 'suspicious';
        }
        break;
      }
    }

    // Penalizar subdomínios muito profundos
    const subdomainCount = domain.split('.').length - 2;
    if (subdomainCount > 2) {
      securityScore -= 10;
      warnings.push('Domínio com muitos subníveis');
    }

    // Bonificar HTTPS
    if (url.startsWith('https://')) {
      securityScore += 5;
    }

    // Ajustar categoria baseada no score
    if (securityScore >= 80 && domainCategory === 'unknown') {
      domainCategory = 'educational';
    } else if (securityScore < 50) {
      domainCategory = 'suspicious';
    }

    return {
      securityScore: Math.max(0, Math.min(100, securityScore)),
      domainCategory,
      warnings
    };
  }

  private async checkGoogleSafeBrowsing(url: string): Promise<ValidationResult['safeBrowsingResult']> {
    if (!this.apiKey) {
      return { isSafe: true, source: 'local' };
    }

    try {
      // Verificar cache primeiro
      const cached = this.safeBrowsingCache.get(url);
      if (cached && (Date.now() - cached.timestamp) < (this.config.cacheExpirationMinutes * 60 * 1000)) {
        return {
          isSafe: cached.result,
          threatTypes: cached.threatTypes,
          source: 'cache'
        };
      }

      // Garantir que a URL está no formato correto (sem normalização extra)
      const urlToCheck = url.startsWith('http://') || url.startsWith('https://') 
        ? url 
        : `https://${url}`;

      const requestBody = {
        client: {
          clientId: "mobclass-web",
          clientVersion: "1.0.0"
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION"
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: urlToCheck }]
        }
      };

      const response = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        return { isSafe: true, source: 'local' };
      }

      const data = await response.json();
      const isSafe = !data.matches || data.matches.length === 0;
      const threatTypes = data.matches ? data.matches.map((match: any) => match.threatType) : [];

      // Cachear resultado
      this.safeBrowsingCache.set(url, {
        result: isSafe,
        timestamp: Date.now(),
        threatTypes: threatTypes
      });

      return {
        isSafe,
        threatTypes,
        source: 'google'
      };

    } catch (error) {
      return { isSafe: true, source: 'local' };
    }
  }

  private compileFinalResult(
    url: string,
    localAnalysis: ReturnType<typeof this.performLocalAnalysis>,
    safeBrowsingResult?: ValidationResult['safeBrowsingResult']
  ): ValidationResult {
    let finalScore = localAnalysis.securityScore;
    let isValid = true;
    let domainCategory = localAnalysis.domainCategory;
    const warnings = [...localAnalysis.warnings];

    // Aplicar resultado do Safe Browsing
    if (safeBrowsingResult && !safeBrowsingResult.isSafe) {
      finalScore = Math.min(finalScore, 20);
      isValid = false;
      domainCategory = 'blocked';
      warnings.push('URL detectada como ameaça pelo Google Safe Browsing');
      
      if (safeBrowsingResult.threatTypes && safeBrowsingResult.threatTypes.length > 0) {
        warnings.push(`Tipos de ameaça: ${safeBrowsingResult.threatTypes.join(', ')}`);
      }
    }

    // Determinar se é válida baseada no score final
    if (finalScore < 30) {
      isValid = false;
    } else if (finalScore < 60) {
      isValid = true; // Permitir mas com aviso
    }

    return {
      isValid,
      sanitizedUrl: url,
      securityScore: finalScore,
      domainCategory,
      warnings: warnings.length > 0 ? warnings : undefined,
      allowWithWarning: isValid && finalScore < 70,
      safeBrowsingResult
    };
  }

  private checkRateLimit(userIp: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto
    
    const userAttempts = this.rateLimitTracker.get(userIp) || [];
    
    // Remover tentativas antigas
    const recentAttempts = userAttempts.filter(timestamp => now - timestamp < windowMs);
    
    if (recentAttempts.length >= this.config.rateLimitPerMinute) {
      return false;
    }
    
    recentAttempts.push(now);
    this.rateLimitTracker.set(userIp, recentAttempts);
    
    return true;
  }

  private getCacheKey(url: string): string {
    return `url_validation_${url}`;
  }

  private getCachedResult(cacheKey: string): ValidationResult | null {
    return this.cache.get(cacheKey) || null;
  }

  private setCachedResult(cacheKey: string, result: ValidationResult): void {
    // Limitar tamanho do cache
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(cacheKey, result);
  }

  private logValidationAttempt(url: string, result: ValidationResult, userIp?: string): void {
    if (!this.config.logAttempts) return;

    // Adicionar às tentativas suspeitas se score muito baixo
    if (result.securityScore !== undefined && result.securityScore < 30) {
      this.suspiciousAttempts.push({
        url,
        timestamp: Date.now(),
        userIp
      });
    }
    // Em produção, enviaria para um serviço de logging
  }

  // Método utilitário para limpar caches antigos
  public clearOldCaches(): void {
    const now = Date.now();
    const expirationTime = this.config.cacheExpirationMinutes * 60 * 1000;
    
    // Limpar cache do Safe Browsing
    for (const [url, data] of this.safeBrowsingCache.entries()) {
      if (now - data.timestamp > expirationTime) {
        this.safeBrowsingCache.delete(url);
      }
    }
    
    // Limpar rate limit tracker (manter apenas última hora)
    const hourAgo = now - (60 * 60 * 1000);
    for (const [ip, attempts] of this.rateLimitTracker.entries()) {
      const recentAttempts = attempts.filter(timestamp => timestamp > hourAgo);
      if (recentAttempts.length === 0) {
        this.rateLimitTracker.delete(ip);
      } else {
        this.rateLimitTracker.set(ip, recentAttempts);
      }
    }
  }

  // Métodos públicos para compatibilidade com o hook
  public getTrustedDomains(): string[] {
    return Array.from(this.trustedDomains);
  }

  public getSecurityStats(): {
    cacheSize: number;
    suspiciousAttempts: number;
    rateLimitEntries: number;
    trustedDomains: number;
    apiEnabled?: boolean;
  } {
    return {
      cacheSize: this.safeBrowsingCache.size,
      suspiciousAttempts: this.suspiciousAttempts.length,
      rateLimitEntries: this.rateLimitTracker.size,
      trustedDomains: this.trustedDomains.size,
      apiEnabled: this.config.enableSafeBrowsing && !!this.apiKey
    };
  }

  public clearCache(): void {
    this.cache.clear();
    this.safeBrowsingCache.clear();
  }

  public getSuspiciousAttempts(): Array<{ url: string; timestamp: number; userAgent?: string; userIp?: string }> {
    return [...this.suspiciousAttempts];
  }
}

// Instância singleton para uso global
export const urlSecurityService = URLSecurityService.getInstance();

// Executar limpeza de cache a cada 30 minutos
if (typeof window !== 'undefined') {
  setInterval(() => {
    urlSecurityService.clearOldCaches();
  }, 30 * 60 * 1000);
}
