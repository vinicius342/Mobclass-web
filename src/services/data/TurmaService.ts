import type { Turma } from '../../models/Turma';

const API_URL = 'https://mobclassapi-3ohr3pb77q-uc.a.run.app';

// Util interno para extrair o número da série a partir do nome da turma (ex.: "7º A" -> 7)
const extrairNumeroSerie = (nomeTurma: string): number => {
  const match = nomeTurma?.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

export const turmaService = {
  listarTodas: async (): Promise<Turma[]> => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'turma', action: 'listar' }),
    });
    if (!response.ok) throw new Error('Erro ao listar turmas');
    return response.json();
  },

  buscarPorId: async (id: string): Promise<Turma | null> => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'turma', action: 'buscarPorId', id }),
    });
    if (!response.ok) throw new Error('Erro ao buscar turma');
    return response.json();
  },

  listarPorAnoLetivo: async (anoLetivo: string): Promise<Turma[]> => {
    const turmas = await turmaService.listarTodas();
    return turmas.filter((t: Turma) => t.anoLetivo === anoLetivo);
  },

  listarComVirtualizacao: async (anoLetivo: string): Promise<Turma[]> => {
    const todasTurmas = await turmaService.listarTodas();

    const turmasReaisAnoAtual = todasTurmas.filter((t: Turma) =>
      t.anoLetivo === anoLetivo && !t.turmaOriginalId
    );

    const anoAnterior = (parseInt(anoLetivo) - 1).toString();
    const turmasAnoAnterior = todasTurmas.filter((t: Turma) =>
      t.anoLetivo === anoAnterior && !t.turmaOriginalId
    );

    const turmasVirtualizadas = turmasAnoAnterior
      .filter((turmaAnterior: Turma) => {
        const podeVirtualizar = turmaAnterior.isVirtual !== false;
        const jaExisteNoAnoAtual = turmasReaisAnoAtual.some((t: Turma) => t.nome === turmaAnterior.nome);
        return podeVirtualizar && !jaExisteNoAnoAtual;
      })
      .map((turmaAnterior: Turma) => ({
        ...turmaAnterior,
        id: `virtual_${anoLetivo}_${turmaAnterior.id}`,
        anoLetivo: anoLetivo,
        turmaOriginalId: turmaAnterior.id
      }));

    return [...turmasReaisAnoAtual, ...turmasVirtualizadas];
  },

  obterProximoAnoComVirtualizacao: async (anoAtual: string): Promise<Turma[]> => {
    const todasTurmas = await turmaService.listarTodas();
    const anoProximo = (parseInt(anoAtual) + 1).toString();

    const turmasReaisProximoAno = todasTurmas.filter(
      (t: Turma) => t.anoLetivo === anoProximo && !t.turmaOriginalId
    );

    const turmasAnoAtualReais = todasTurmas.filter(
      (t: Turma) => t.anoLetivo === anoAtual && !t.turmaOriginalId
    );

    const turmasVirtualizadas = turmasAnoAtualReais
      .filter((tAnt: Turma) => tAnt.isVirtual !== false && !turmasReaisProximoAno.some((r: Turma) => r.nome === tAnt.nome))
      .map((tAnt: Turma) => ({
        ...tAnt,
        id: `virtual_${anoProximo}_${tAnt.id}`,
        anoLetivo: anoProximo,
        turmaOriginalId: tAnt.id
      }));

    return [...turmasReaisProximoAno, ...turmasVirtualizadas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  },

  resolverDestinoReprovacao: async (turmaAtual: Turma, anoAtual: string): Promise<Turma> => {
    const proximoAnoTurmas = await turmaService.obterProximoAnoComVirtualizacao(anoAtual);

    const mesmaTurma = proximoAnoTurmas.find(t => t.nome === turmaAtual.nome);
    if (mesmaTurma) return mesmaTurma;

    const prefixo = turmaAtual.nome.split(' ').slice(0, 2).join(' ');
    const mesmaSerie = proximoAnoTurmas.filter(t => t.nome.startsWith(prefixo));
    if (mesmaSerie.length > 0) return mesmaSerie[0];

    const anoProximo = (parseInt(anoAtual) + 1).toString();
    return {
      ...turmaAtual,
      id: `virtual_${anoProximo}_${turmaAtual.id}`,
      anoLetivo: anoProximo,
      turmaOriginalId: turmaAtual.id
    };
  },

  validarPromocao: (turmaAtual: Turma, turmaDestino: Turma): { ok: boolean; motivo?: string } => {
    const serieAtual = extrairNumeroSerie(turmaAtual.nome);
    const serieDestino = extrairNumeroSerie(turmaDestino.nome);

    if (serieDestino <= serieAtual) {
      return {
        ok: false,
        motivo: 'Para promover, a turma de destino deve ser de série superior à atual'
      };
    }

    return { ok: true };
  },

  validarTransferencia: (turmaAtual: Turma, turmaDestino: Turma): { ok: boolean; motivo?: string } => {
    const serieAtual = extrairNumeroSerie(turmaAtual.nome);
    const serieDestino = extrairNumeroSerie(turmaDestino.nome);

    if (serieDestino > serieAtual + 1) {
      return {
        ok: false,
        motivo: 'Não é permitido transferir para série superior além de um nível'
      };
    }

    return { ok: true };
  },

  resolverDestinoPromocao: async (
    turmaAtual: Turma,
    anoAtual: string,
    proximaTurmaId: string
  ): Promise<Turma | null> => {
    // Tenta localizar na lista combinada do próximo ano
    const listaProximoAno = await turmaService.obterProximoAnoComVirtualizacao(anoAtual);
    let destino = listaProximoAno.find(t => t.id === proximaTurmaId) || null;

    // Fallback: tentar buscar diretamente pelo serviço (caso lista não contenha)
    if (!destino) {
      destino = (await turmaService.buscarPorId(proximaTurmaId)) as Turma | null;
    }

    // Validar promoção com base na turma atual, se destino encontrado
    if (destino) {
      const validacao = turmaService.validarPromocao(turmaAtual, destino);
      if (!validacao.ok) return null;
    }

    return destino;
  },

  criar: async (turma: Omit<Turma, 'id' | 'turmaOriginalId'>): Promise<string> => {
    if (!turma.nome || !turma.anoLetivo || !turma.turno) {
      throw new Error('Dados obrigatórios da turma não preenchidos');
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'turma', action: 'criar', turma })
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar turma: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  },

  atualizar: async (id: string, turma: Partial<Omit<Turma, 'id' | 'turmaOriginalId'>>): Promise<void> => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'turma', action: 'atualizar', id, turma })
    });

    if (!response.ok) {
      throw new Error(`Erro ao atualizar turma: ${response.statusText}`);
    }
  },

  excluir: async (id: string): Promise<void> => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'turma', action: 'excluir', id })
    });

    if (!response.ok) {
      throw new Error(`Erro ao excluir turma: ${response.statusText}`);
    }
  },

  gerarTurmasVirtualizadas: async (turmasAtuais: Turma[], anoProximo: string): Promise<Turma[]> => {
    const turmasVirtualizadas: Turma[] = [];

    for (const turmaAtual of turmasAtuais) {
      const podeVirtualizar = turmaAtual.isVirtual !== false;

      if (podeVirtualizar) {
        turmasVirtualizadas.push({
          ...turmaAtual,
          id: `virtual_${anoProximo}_${turmaAtual.id}`,
          anoLetivo: anoProximo,
          turmaOriginalId: turmaAtual.id
        });
      }
    }

    return turmasVirtualizadas;
  },

  materializarTurma: async (turmaVirtual: Turma): Promise<string> => {
    if (!turmaVirtual.turmaOriginalId) {
      throw new Error('Turma não é virtualizada');
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'turma', action: 'materializarTurma', turmaVirtual })
    });

    if (!response.ok) {
      throw new Error(`Erro ao materializar turma: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  },

  /**
   * Materializa turma virtual se necessário, copiando vínculos e agenda
   * Aceita tanto ID quanto objeto Turma
   * Retorna o ID da turma materializada ou o ID original se não for virtual
   */
  materializarTurmaVirtualComDados: async (
    turmaIdOuObjeto: string | Turma,
    turmasCache?: Turma[],
    excluirAgendasIds?: string[]
  ): Promise<string> => {
    // Resolver turma a partir do parâmetro
    let turmaVirtual: Turma | undefined;

    if (typeof turmaIdOuObjeto === 'string') {
      const turmaId = turmaIdOuObjeto;
      
      // Se é um ID virtual, buscar APENAS no cache (não existe no Firebase)
      if (turmaId.startsWith('virtual_')) {
        if (turmasCache) {
          turmaVirtual = turmasCache.find(t => t.id === turmaId);
        }
        
        if (!turmaVirtual) {
          console.warn(`⚠️ Turma virtual ${turmaId} não encontrada no cache`);
          return turmaId; // Retornar o ID original se não encontrar
        }
      } else {
        // Turma real: buscar no cache ou no serviço
        if (turmasCache) {
          turmaVirtual = turmasCache.find(t => t.id === turmaId);
        }
        
        if (!turmaVirtual) {
          turmaVirtual = (await turmaService.buscarPorId(turmaId)) || undefined;
        }
      }
    } else {
      turmaVirtual = turmaIdOuObjeto;
    }

    const turmaId = typeof turmaIdOuObjeto === 'string' ? turmaIdOuObjeto : turmaIdOuObjeto.id;

    // Se não encontrou ou não é virtual, retornar o ID original
    if (!turmaVirtual || !turmaVirtual.turmaOriginalId) {
      return turmaId;
    }

    // Chamar backend para materializar com dados
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        domain: 'turma', 
        action: 'materializarTurmaVirtualComDados', 
        turmaVirtual,
        excluirAgendasIds 
      })
    });

    if (!response.ok) {
      throw new Error(`Erro ao materializar turma com dados: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }
}
