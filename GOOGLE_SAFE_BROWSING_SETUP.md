# Configuração do Google Safe Browsing API

## Visão Geral

O sistema de validação de URLs foi atualizado para integrar com a Google Safe Browsing API, oferecendo proteção avançada contra URLs maliciosas, phishing e malware.

## Funcionalidades Implementadas

### ✅ Validação Local
- Verificação de domínios confiáveis (educacionais, governamentais)
- Detecção de padrões suspeitos
- Análise de estrutura de URL
- Sistema de pontuação de segurança (0-100)

### ✅ Integração Google Safe Browsing API
- Verificação externa contra base de dados do Google
- Cache inteligente para otimizar performance
- Fallback para validação local em caso de erro
- Rate limiting e proteção contra abuso

### ✅ Sistema de Cache
- Cache local para resultados recentes
- Expiração automática configurável
- Limpeza periódica de cache antigo

## Configuração da API

### 1. Obter Chave da API

1. Acesse [Google Cloud Console](https://console.developers.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Safe Browsing API**:
   - Navegue para "APIs & Services" > "Library"
   - Pesquise por "Safe Browsing API"
   - Clique em "Enable"
4. Crie credenciais:
   - Vá para "APIs & Services" > "Credentials"
   - Clique em "Create Credentials" > "API Key"
   - Copie a chave gerada

### 2. Configurar Variável de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_GOOGLE_SAFE_BROWSING_API_KEY=sua_chave_api_aqui
```

### 3. Configurar Restrições (Recomendado)

No Google Cloud Console, configure restrições para sua API Key:

1. Clique na chave criada em "Credentials"
2. Em "Application restrictions":
   - Selecione "HTTP referrers"
   - Adicione seus domínios (ex: `https://seudominio.com/*`)
3. Em "API restrictions":
   - Selecione "Restrict key"
   - Escolha apenas "Safe Browsing API"

## Uso no Código

### Hook useUrlValidator

```typescript
import { useUrlValidator } from '../hooks/useUrlValidator';

function MeuComponente() {
  const { validateUrl, isValidating, lastValidation } = useUrlValidator();

  const handleValidateUrl = async (url: string) => {
    const result = await validateUrl(url);
    
    if (result.isValid) {
      console.log('URL segura:', result.sanitizedUrl);
      console.log('Score de segurança:', result.securityScore);
    } else {
      console.log('URL bloqueada:', result.error);
      console.log('Avisos:', result.warnings);
    }
  };

  return (
    // Seu JSX aqui
  );
}
```

### Validação Múltipla

```typescript
const { validateMultipleUrls } = useUrlValidator();

const urls = ['https://exemplo1.com', 'https://exemplo2.com'];
const results = await validateMultipleUrls(urls);

results.forEach((result, index) => {
  console.log(`URL ${index + 1}:`, result.isValid ? 'Segura' : 'Bloqueada');
});
```

## Configurações Avançadas

### Personalizar Configuração

```typescript
import { urlSecurityService } from '../services/urlSecurity';

// Atualizar configurações
urlSecurityService.updateConfig({
  allowHttp: false,
  maxUrlLength: 1000,
  enableSafeBrowsing: true,
  rateLimitPerMinute: 50
});
```

### Estatísticas de Segurança

```typescript
const { securityStats } = useUrlValidator();

console.log('Cache size:', securityStats.cacheSize);
console.log('API habilitada:', securityStats.apiEnabled);
console.log('Tentativas suspeitas:', securityStats.suspiciousAttempts);
```

## Limites e Custos

### Google Safe Browsing API

- **Gratuito**: Até 10.000 consultas por dia
- **Performance**: ~200ms por consulta (com cache, <10ms)
- **Confiabilidade**: 99.9% uptime do Google

### Sistema de Cache

- Cache local: Resultados válidos por 30 minutos
- Rate limiting: 100 consultas por minuto por IP
- Limpeza automática: A cada 30 minutos

## Segurança

### Domínios Pré-aprovados

O sistema inclui uma lista de domínios confiáveis que são sempre permitidos:

- Domínios educacionais (.edu, .edu.br)
- Domínios governamentais (.gov.br)
- Sites populares (Google, GitHub, Wikipedia, etc.)
- Plataformas educacionais (Coursera, Khan Academy, etc.)

### Padrões Suspeitos Detectados

- Encurtadores de URL suspeitos
- IPs diretos como URL
- Palavras-chave de phishing
- Subdomínios excessivamente longos
- Domínios IDN suspeitos

## Troubleshooting

### API Key não funcionando

1. Verifique se a variável de ambiente está correta
2. Confirme se a Safe Browsing API está ativada
3. Verifique as restrições da API Key
4. Monitore o console para erros de API

### Performance lenta

1. Verifique se o cache está funcionando
2. Considere reduzir `rateLimitPerMinute`
3. Monitore o tamanho do cache
4. Verifique a conexão de rede

### URLs sendo bloqueadas incorretamente

1. Verifique a lista de domínios confiáveis
2. Analise o score de segurança
3. Consulte os warnings retornados
4. Considere ajustar os padrões suspeitos

## Logs e Monitoramento

O sistema registra automaticamente:

- Tentativas de validação
- Resultados de segurança
- Uso de cache vs API
- Tentativas suspeitas

Para produção, considere integrar com um serviço de logging como Sentry ou LogRocket.

## Próximos Passos

1. **Configurar a API Key** seguindo as instruções acima
2. **Testar** com URLs conhecidas (seguras e maliciosas)
3. **Monitorar** uso da API e performance
4. **Ajustar** configurações conforme necessário

## Suporte

Para dúvidas sobre a implementação, consulte:

- [Documentação Google Safe Browsing API](https://developers.google.com/safe-browsing/v4)
- [Console Google Cloud](https://console.cloud.google.com/)
- Logs do navegador para debugging
