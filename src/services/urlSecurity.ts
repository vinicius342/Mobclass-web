// Serviço avançado de validação de URLs para prevenir phishing e links maliciosos

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
  warnings?: string[];
  securityScore?: number; // 0-100, quanto maior, mais seguro
  allowWithWarning?: boolean; // Permite URL mas com aviso
  domainCategory?: 'trusted' | 'educational' | 'unknown' | 'suspicious' | 'blocked';
  externalValidation?: {
    safeBrowsing?: boolean;
    phishTank?: boolean;
    checked: boolean;
  };
}

export interface SecurityConfig {
  allowHttp: boolean;
  maxUrlLength: number;
  enableSubdomainCheck: boolean;
  logAttempts: boolean;
  enableExternalValidation: boolean;
  rateLimitPerMinute: number;
  enableContentAnalysis: boolean;
}

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

class URLSecurityService {
  private static instance: URLSecurityService;
  private cache = new Map<string, ValidationResult>();
  private suspiciousAttempts: Array<{ url: string; timestamp: number; userAgent?: string; userIp?: string }> = [];
  private rateLimitMap = new Map<string, RateLimitEntry>();

  private readonly config: SecurityConfig = {
    allowHttp: false,
    maxUrlLength: 500,
    enableSubdomainCheck: true,
    logAttempts: true,
    enableExternalValidation: false, // Desabilitado por padrão para performance
    rateLimitPerMinute: 20,
    enableContentAnalysis: false // Desabilitado por padrão
  };

  // Domínios confiáveis expandidos
  private readonly trustedDomains = [
    // Educacionais internacionais
    'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
    'khanacademy.org', 'coursera.org', 'edx.org', 'udemy.com',
    'ted.com', 'nationalgeographic.com', 'britannica.com',
    'wikipedia.org', 'wikimedia.org', 'wikibooks.org',
    
    // Google Services
    'google.com', 'docs.google.com', 'drive.google.com',
    'sites.google.com', 'classroom.google.com', 'meet.google.com',
    'forms.google.com', 'slides.google.com', 'sheets.google.com',
    'scholar.google.com', 'books.google.com',
    
    // Microsoft
    'microsoft.com', 'office.com', 'onedrive.live.com',
    'sharepoint.com', 'teams.microsoft.com', 'outlook.com',
    'msn.com', 'bing.com',
    
    // Governamentais e educacionais brasileiros
    'gov.br', 'mec.gov.br', 'capes.gov.br', 'inep.gov.br',
    'cnpq.br', 'fapesp.br', 'scielo.br', 'periodicos.capes.gov.br',
    'brasil.gov.br', 'planalto.gov.br',
    
    // Universidades brasileiras principais
    'usp.br', 'unicamp.br', 'ufrj.br', 'ufmg.br', 'ufsc.br',
    'puc-rio.br', 'fgv.br', 'mackenzie.br', 'ufpe.br', 'ufba.br',
    'unb.br', 'ufpr.br', 'ufrgs.br', 'ufes.br',
    
    // Portais de notícias confiáveis
    'bbc.com', 'cnn.com', 'reuters.com', 'ap.org',
    'folha.uol.com.br', 'globo.com', 'estadao.com.br',
    'uol.com.br', 'ig.com.br', 'terra.com.br',
    
    // Tecnologia e desenvolvimento
    'github.com', 'gitlab.com', 'stackoverflow.com',
    'mozilla.org', 'w3schools.com', 'codecademy.com',
    'freecodecamp.org', 'developer.mozilla.org',
    'npm.js.com', 'pypi.org',
    
    // Outros sites educativos e confiáveis
    'archive.org', 'gutenberg.org', 'mit.edu',
    'stanford.edu', 'harvard.edu', 'ox.ac.uk',
    'nature.com', 'science.org', 'ieee.org',
    'acm.org', 'researchgate.net'
  ];

  // TLDs educacionais e governamentais sempre confiáveis
  private readonly trustedTlds = [
    '.edu', '.edu.br', '.gov', '.gov.br', '.org.br',
    '.ac.uk', '.edu.au', '.edu.ca', '.mil'
  ];

  // Domínios maliciosos conhecidos (expandido)
  private readonly blockedDomains = [
    // Encurtadores
    'bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'rb.gy',
    'linktr.ee', 'shorturl.at', 'cutt.ly', 'rebrand.ly',
    'goo.gl', 'ow.ly', 'buff.ly', 'soo.gd',
    
    // Conhecidos por phishing
    'tiny.cc', 'tr.im', 'cli.gs', 'short.link',
    'bitly.com', 'v.gd', 'x.co', 'migre.me'
  ];

  // Esquemas perigosos que devem ser bloqueados
  private readonly dangerousSchemes = [
    'javascript:', 'data:', 'file:', 'vbscript:', 'about:', 'chrome:',
    'chrome-extension:', 'moz-extension:', 'ms-appx:', 'ms-appx-web:'
  ];

  // Padrões suspeitos expandidos
  private readonly suspiciousPatterns = [
    // URLs com caracteres unicode suspeitos
    /[\u200B-\u200D\uFEFF]/g, // Zero-width characters
    /[а-я]/g, // Cyrillic characters (podem ser confundidas com latinas)
    
    // Padrões de phishing específicos e realistas
    /g[o0]{3,}gle/i, // Múltiplos 'o' ou '0' (ex: goooogle)
    /goog1e|googIe|9oogle|googl3/i, // Google com substituições específicas
    /microsft|mircosoft|microsofy|microsof1|m1crosoft/i,
    /youtub[3]|y[o0]{2,}utube|y0utube|y0u1ube/i, // YouTube suspeito
    /faceb[o0]{2,}k|fac3book|facebook1|fac3b00k/i,
    
    // Phishing específico de sites populares
    /paypaI|payp4l|payp4I|paipal/i, // PayPal com 'I' maiúsculo ou '4'
    /amazom|amaz0n|amazone|4mazon/i, // Amazon com substituições
    /netfIix|netf1ix|n3tflix|netfliks/i, // Netflix com 'I' maiúsculo
    /whatsapP|whats4pp|whatsap|whatsapp1/i, // WhatsApp
    /inst4gram|1nstagram|instagr4m|instagramm/i, // Instagram
    /linkedln|link3din|linkedinc|linkedin1/i, // LinkedIn com 'l' minúsculo
    
    // Phishing de sites brasileiros
    /santand3r|santanderr|s4ntander/i, // Santander
    /bradesc0|brad3sco|bradesco1/i, // Bradesco
    /itauu|it4u|ita1|itau1/i, // Itaú
    /caixaa|caix4|c4ixa|caixa1/i, // Caixa
    /mercad0livre|mercadoIivre|mercad0l1vre/i, // MercadoLivre
    
    // Múltiplos subdomínios suspeitos (mais de 4 níveis)
    /^https?:\/\/[^\/]+\.[^\/]+\.[^\/]+\.[^\/]+\.[^\/]+/i,
    
    // URLs com IP (já verificado antes, mas mantém como backup)
    /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i,
    
    // Parâmetros suspeitos de redirecionamento
    /[?&](redirect|goto|url|link|target|destination|continue|return|next)=/i,
    
    // Encoding duplo suspeito
    /%25[0-9a-f]{2}/i,
    
    // Ataques de path traversal
    /\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\|%252e%252e%252f/i,
    
    // Caracteres suspeitos em hostnames
    /@.*@|%40.*%40/i,
    
    // URLs com muitos redirecionamentos
    /\/\/.*\/\/.*\/\//,
    
    // Tentativas de confundir com subdomínios
    /^https?:\/\/[^.]*google[^.]*\.[^google]/i, // google em subdomain mas não .google.com
    /^https?:\/\/[^.]*microsoft[^.]*\.[^microsoft]/i, // microsoft em subdomain
    /^https?:\/\/[^.]*facebook[^.]*\.[^facebook]/i, // facebook em subdomain
    
    // URLs com muitos hífens ou underscores (suspeito)
    /[-_]{3,}/,
    
    // URLs com extensões de arquivos suspeitas
    /\.(exe|bat|scr|com|pif|cmd|vbs|js|jar|zip|rar)($|\?|&|#)/i
  ];

  public static getInstance(): URLSecurityService {
    if (!URLSecurityService.instance) {
      URLSecurityService.instance = new URLSecurityService();
    }
    return URLSecurityService.instance;
  }

  public validateUrl(url: string, userIp?: string): ValidationResult {
    // 1. Rate Limiting por IP/usuário
    if (userIp && !this.checkRateLimit(userIp)) {
      return { 
        isValid: false, 
        error: 'Muitas tentativas de validação. Tente novamente em alguns minutos.',
        securityScore: 0
      };
    }

    // 2. Verifica cache primeiro
    const cacheKey = url.trim().toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 3. Normalização e validação
    const result = this.performAdvancedValidation(url);
    
    // 4. Armazena no cache (máximo 1000 entradas)
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(cacheKey, result);

    // 5. Log tentativas suspeitas
    if (!result.isValid && this.config.logAttempts) {
      this.logSuspiciousAttempt(url, userIp);
    }

    return result;
  }

  private checkRateLimit(userIp: string): boolean {
    const now = Date.now();
    const minute = 60 * 1000;
    
    const existing = this.rateLimitMap.get(userIp);
    
    if (!existing) {
      this.rateLimitMap.set(userIp, {
        count: 1,
        firstRequest: now,
        lastRequest: now
      });
      return true;
    }

    // Reset se passou mais de 1 minuto
    if (now - existing.firstRequest > minute) {
      this.rateLimitMap.set(userIp, {
        count: 1,
        firstRequest: now,
        lastRequest: now
      });
      return true;
    }

    // Incrementa contador
    existing.count++;
    existing.lastRequest = now;

    return existing.count <= this.config.rateLimitPerMinute;
  }

  private normalizeUrl(url: string): string {
    let normalized = url.trim();
    
    // Remove múltiplas barras
    normalized = normalized.replace(/([^:]\/)\/+/g, '$1');
    
    // Resolve encoding duplo
    try {
      let decoded = normalized;
      let previousDecoded = '';
      let iterations = 0;
      
      // Máximo 3 iterações para evitar loop infinito
      while (decoded !== previousDecoded && iterations < 3) {
        previousDecoded = decoded;
        decoded = decodeURIComponent(decoded);
        iterations++;
      }
      normalized = decoded;
    } catch {
      // Se der erro no decode, mantém original
    }
    
    // Remove fragmentos (#)
    normalized = normalized.split('#')[0];
    
    // Adiciona protocolo se necessário
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = `https://${normalized}`;
    }
    
    // Força HTTPS
    if (!this.config.allowHttp) {
      normalized = normalized.replace(/^http:\/\//i, 'https://');
    }
    
    return normalized;
  }

  private performAdvancedValidation(url: string): ValidationResult {
    const warnings: string[] = [];
    let securityScore = 100;
    
    // 1. Verificações básicas
    if (!url || typeof url !== 'string') {
      return { isValid: false, error: 'URL não pode estar vazia', securityScore: 0 };
    }

    const trimmedUrl = url.trim();
    if (trimmedUrl.length === 0) {
      return { isValid: false, error: 'URL não pode estar vazia', securityScore: 0 };
    }

    if (trimmedUrl.length > this.config.maxUrlLength) {
      return { 
        isValid: false, 
        error: `URL muito longa (máximo ${this.config.maxUrlLength} caracteres)`,
        securityScore: 0
      };
    }

    // 2. Normalização avançada
    const normalizedUrl = this.normalizeUrl(trimmedUrl);

    // 3. Verificação de esquemas perigosos
    for (const scheme of this.dangerousSchemes) {
      if (normalizedUrl.toLowerCase().startsWith(scheme)) {
        return { 
          isValid: false, 
          error: `Esquema '${scheme}' não é permitido por segurança`,
          securityScore: 0
        };
      }
    }

    // 4. Validação de formato
    let urlObj: URL;
    try {
      urlObj = new URL(normalizedUrl);
    } catch {
      return { isValid: false, error: 'Formato de URL inválido', securityScore: 0 };
    }

    // 5. Verifica protocolo
    if (!['https:', 'http:'].includes(urlObj.protocol)) {
      return { 
        isValid: false, 
        error: 'Apenas protocolos HTTP e HTTPS são permitidos',
        securityScore: 0
      };
    }

    // 6. Verificações de segurança no hostname
    const hostname = urlObj.hostname.toLowerCase();
    
    // 6a. Verifica se é IP direto (suspeito)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return { 
        isValid: false, 
        error: 'URLs com endereços IP não são permitidas',
        securityScore: 0
      };
    }

    // 6b. Verifica caracteres suspeitos no hostname
    if (/@/.test(hostname)) {
      return { 
        isValid: false, 
        error: 'Hostname contém caracteres suspeitos (@)',
        securityScore: 0
      };
    }

    // 6c. Verifica punycode suspeito
    if (hostname.includes('xn--')) {
      securityScore -= 20;
      warnings.push('URL contém caracteres internacionais (punycode)');
    }

    // 7. Verifica domínios bloqueados
    for (const blocked of this.blockedDomains) {
      if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
        return { 
          isValid: false, 
          error: `Domínio '${blocked}' está bloqueado (encurtador/suspeito)`,
          securityScore: 0
        };
      }
    }

    // 8. Verifica padrões suspeitos expandidos (mas pula se for domínio confiável)
    const isKnownTrustedDomain = this.trustedDomains.some(trusted => 
      urlObj.hostname.toLowerCase() === trusted || urlObj.hostname.toLowerCase().endsWith(`.${trusted}`)
    );
    
    // Só aplica padrões suspeitos se NÃO for um domínio explicitamente confiável
    if (!isKnownTrustedDomain) {
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(normalizedUrl)) {
          console.log(`[URL Security] Padrão suspeito detectado: ${pattern} em ${normalizedUrl}`);
          return { 
            isValid: false, 
            error: 'URL contém padrões suspeitos de phishing ou ataque',
            securityScore: 0
          };
        }
      }
    } else {
      console.log(`[URL Security] Domínio ${urlObj.hostname.toLowerCase()} é confiável, pulando verificação de padrões suspeitos`);
    }

    // 9. Classificação do domínio
    let domainCategory: 'trusted' | 'educational' | 'unknown' | 'suspicious' | 'blocked' = 'unknown';
    let isDomainTrusted = false;

    // Log de debug para investigação
    console.log('[URL Security Debug]', {
      hostname,
      url: normalizedUrl,
      score: securityScore,
      trustedDomains: this.trustedDomains.slice(0, 10) // Mostra apenas os primeiros 10
    });

    // 9a. Verifica domínios explicitamente confiáveis
    isDomainTrusted = this.trustedDomains.some(trusted => {
      const isMatch = hostname === trusted || hostname.endsWith(`.${trusted}`);
      if (isMatch) {
        console.log(`[URL Security] Domínio confiável encontrado: ${trusted} para ${hostname}`);
      }
      return isMatch;
    });

    if (isDomainTrusted) {
      domainCategory = 'trusted';
      securityScore += 20; // Bonus por ser domínio confiável
      console.log(`[URL Security] Domínio ${hostname} marcado como confiável`);
    } else {
      console.log(`[URL Security] Domínio ${hostname} NÃO encontrado na lista de confiáveis`);
      
      // 9b. Verifica TLDs educacionais/governamentais
      const isEducationalTld = this.trustedTlds.some(tld => hostname.endsWith(tld));
      
      if (isEducationalTld) {
        domainCategory = 'educational';
        securityScore += 15;
        warnings.push('Domínio educacional/governamental aceito automaticamente');
        isDomainTrusted = true;
        console.log(`[URL Security] Domínio ${hostname} aceito por TLD educacional`);
      } else {
        // 9c. Verifica se é domínio organizacional (.org)
        if (hostname.endsWith('.org')) {
          domainCategory = 'educational';
          securityScore += 10;
          warnings.push('Domínio organizacional (.org) aceito com verificação extra');
          isDomainTrusted = true;
          console.log(`[URL Security] Domínio ${hostname} aceito por ser .org`);
        }
      }
    }

    // 9d. Se não é confiável, mas tem score alto, permite com aviso
    if (!isDomainTrusted && securityScore >= 70) {
      return {
        isValid: true,
        allowWithWarning: true,
        sanitizedUrl: normalizedUrl,
        warnings: [...warnings, 'Domínio não está na lista de confiáveis, mas foi aceito após verificação de segurança'],
        securityScore,
        domainCategory: 'unknown'
      };
    }

    // 9e. Se não é confiável e tem score baixo, bloqueia
    if (!isDomainTrusted) {
      return { 
        isValid: false, 
        error: `Domínio '${hostname}' não está na lista de sites confiáveis. Para adicionar um site, entre em contato com o administrador.`,
        securityScore,
        domainCategory: 'unknown'
      };
    }

    // 10. Verificações adicionais de subdomínio
    if (this.config.enableSubdomainCheck) {
      const subdomains = hostname.split('.');
      if (subdomains.length > 4) {
        securityScore -= 10;
        warnings.push('URL com muitos subdomínios - verificação extra aplicada');
      }
    }

    // 11. Verifica parâmetros suspeitos
    const searchParams = urlObj.searchParams;
    const suspiciousParams = ['redirect', 'goto', 'url', 'link', 'target', 'destination', 'continue'];
    for (const param of suspiciousParams) {
      if (searchParams.has(param)) {
        securityScore -= 15;
        warnings.push(`Parâmetro suspeito detectado: ${param}`);
      }
    }

    // 12. Verifica tamanho da URL (quanto maior, mais suspeito)
    if (normalizedUrl.length > 100) {
      securityScore -= Math.min(20, (normalizedUrl.length - 100) / 10);
    }

    // Garante que o score não seja negativo
    securityScore = Math.max(0, Math.min(100, securityScore));

    return {
      isValid: true,
      sanitizedUrl: normalizedUrl,
      warnings: warnings.length > 0 ? warnings : undefined,
      securityScore,
      domainCategory
    };
  }

  private logSuspiciousAttempt(url: string, userIp?: string): void {
    this.suspiciousAttempts.push({
      url,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      userIp
    });

    // Mantém apenas os últimos 100 registros
    if (this.suspiciousAttempts.length > 100) {
      this.suspiciousAttempts.splice(0, 50);
    }

    // Em produção, você pode enviar para um serviço de monitoramento
    console.warn('[URL Security] Tentativa suspeita bloqueada:', {
      url,
      userIp,
      timestamp: new Date().toISOString()
    });
  }

  public getSuspiciousAttempts(): Array<{ url: string; timestamp: number; userAgent?: string; userIp?: string }> {
    return [...this.suspiciousAttempts];
  }

  public getTrustedDomains(): string[] {
    return [...this.trustedDomains];
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getSecurityStats(): {
    cacheSize: number;
    suspiciousAttempts: number;
    rateLimitEntries: number;
    trustedDomains: number;
    blockedDomains: number;
  } {
    return {
      cacheSize: this.cache.size,
      suspiciousAttempts: this.suspiciousAttempts.length,
      rateLimitEntries: this.rateLimitMap.size,
      trustedDomains: this.trustedDomains.length,
      blockedDomains: this.blockedDomains.length
    };
  }
}

// Função de teste para debug
export const testUrlValidation = () => {
  const service = URLSecurityService.getInstance();
  
  const testUrls = [
    // URLs confiáveis (devem passar)
    'https://docs.google.com/document/example',
    'https://www.youtube.com/watch?v=test',
    'https://pt.wikipedia.org/wiki/test',
    'https://www.usp.br',
    
    // URLs suspeitas (devem ser bloqueadas)
    'https://bit.ly/test123',
    'https://goog1e.com/fake',
    'https://paypaI.com/login',
    'https://netfIix.com/login',
    'https://amazom.com/deals',
    'https://microsft.com/office',
    
    // URLs desconhecidas (podem variar)
    'https://exemplo.com.br',
    'https://site-desconhecido.org'
  ];
  
  console.log('=== TESTE DE VALIDAÇÃO DE URLs - Sistema Anti-Phishing ===');
  testUrls.forEach(url => {
    const result = service.validateUrl(url);
    console.log(`\n🔗 ${url}`);
    console.log(`✅ Válida: ${result.isValid}`);
    console.log(`📊 Score: ${result.securityScore}`);
    console.log(`🏷️ Categoria: ${result.domainCategory}`);
    if (result.error) console.log(`❌ Erro: ${result.error}`);
    if (result.warnings) console.log(`⚠️ Avisos: ${result.warnings.join(', ')}`);
    if (result.allowWithWarning) console.log(`⚠️ Permitida com aviso`);
  });
  console.log('=== FIM DO TESTE ===');
};

// Export singleton instance
export const urlSecurityService = URLSecurityService.getInstance();
