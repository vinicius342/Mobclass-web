import { useState, useCallback, useMemo } from 'react';
import { urlSecurityService, ValidationResult } from '../services/urlSecurity';


interface UseUrlValidatorReturn {
  validateUrl: (url: string, userIp?: string) => Promise<ValidationResult>;
  validateMultipleUrls: (urls: string[], userIp?: string) => Promise<ValidationResult[]>;
  isValidating: boolean;
  lastValidation: ValidationResult | null;
  trustedDomains: string[];
  securityStats: {
    cacheSize: number;
    suspiciousAttempts: number;
    rateLimitEntries: number;
    trustedDomains: number;
    apiEnabled?: boolean;
  };
  clearValidationCache: () => void;
  getSuspiciousAttempts: () => Array<{ url: string; timestamp: number; userAgent?: string; userIp?: string }>;
}


export const useUrlValidator = (): UseUrlValidatorReturn => {
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidation, setLastValidation] = useState<ValidationResult | null>(null);

  const validateUrl = useCallback(async (url: string, userIp?: string): Promise<ValidationResult> => {
    setIsValidating(true);
    try {
      const result = await urlSecurityService.validateUrl(url, userIp);
      setLastValidation(result);
      if (result.securityScore !== undefined && result.securityScore < 50) {
        console.warn(`[Security] URL com score baixo (${result.securityScore}): ${url}`);
      }
      return result;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const validateMultipleUrls = useCallback(async (urls: string[], userIp?: string): Promise<ValidationResult[]> => {
    setIsValidating(true);
    try {
      const results = await urlSecurityService.validateMultipleUrls(urls, userIp);
      return results;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const trustedDomains = useMemo(() => {
    return urlSecurityService.getTrustedDomains();
  }, []);

  const securityStats = useMemo(() => {
    return urlSecurityService.getSecurityStats();
  }, []);

  const clearValidationCache = useCallback(() => {
    urlSecurityService.clearCache();
    setLastValidation(null);
  }, []);

  const getSuspiciousAttempts = useCallback(() => {
    return urlSecurityService.getSuspiciousAttempts();
  }, []);

  return {
    validateUrl,
    validateMultipleUrls,
    isValidating,
    lastValidation,
    trustedDomains,
    securityStats,
    clearValidationCache,
    getSuspiciousAttempts
  };
};
