import type { Turma } from '../../models/Turma';
import type { ITurmaRepository } from '../../repositories/ITurmaRepository';

import { FirebaseTurmaRepository } from '../../repositories/FirebaseTurmaRepository';

// Util interno para extrair o número da série a partir do nome da turma (ex.: "7º A" -> 7)
const extrairNumeroSerie = (nomeTurma: string): number => {
  const match = nomeTurma?.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

const turmaRepository: ITurmaRepository = new FirebaseTurmaRepository();

export const turmaService = {
  listarTodas: (): Promise<Turma[]> => turmaRepository.findAll(),

  buscarPorId: (id: string): Promise<Turma | null> => turmaRepository.findById(id),

  listarPorAnoLetivo: async (anoLetivo: string): Promise<Turma[]> => {
    const turmas = await turmaRepository.findAll();
    return turmas.filter(t => t.anoLetivo === anoLetivo);
  },

  listarComVirtualizacao: async (anoLetivo: string): Promise<Turma[]> => {
    const todasTurmas = await turmaRepository.findAll();

    const turmasReaisAnoAtual = todasTurmas.filter(t =>
      t.anoLetivo === anoLetivo && !t.turmaOriginalId
    );

    const anoAnterior = (parseInt(anoLetivo) - 1).toString();
    const turmasAnoAnterior = todasTurmas.filter(t =>
      t.anoLetivo === anoAnterior && !t.turmaOriginalId
    );

    const turmasVirtualizadas = turmasAnoAnterior
      .filter(turmaAnterior => {
        const podeVirtualizar = turmaAnterior.isVirtual !== false;
        const jaExisteNoAnoAtual = turmasReaisAnoAtual.some(t => t.nome === turmaAnterior.nome);
        return podeVirtualizar && !jaExisteNoAnoAtual;
      })
      .map(turmaAnterior => ({
        ...turmaAnterior,
        id: `virtual_${anoLetivo}_${turmaAnterior.id}`,
        anoLetivo: anoLetivo,
        turmaOriginalId: turmaAnterior.id
      }));

    return [...turmasReaisAnoAtual, ...turmasVirtualizadas];
  },

  obterProximoAnoComVirtualizacao: async (anoAtual: string): Promise<Turma[]> => {
    const todasTurmas = await turmaRepository.findAll();
    const anoProximo = (parseInt(anoAtual) + 1).toString();

    const turmasReaisProximoAno = todasTurmas.filter(
      t => t.anoLetivo === anoProximo && !t.turmaOriginalId
    );

    const turmasAnoAtualReais = todasTurmas.filter(
      t => t.anoLetivo === anoAtual && !t.turmaOriginalId
    );

    const turmasVirtualizadas = turmasAnoAtualReais
      .filter(tAnt => tAnt.isVirtual !== false && !turmasReaisProximoAno.some(r => r.nome === tAnt.nome))
      .map(tAnt => ({
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

    // Fallback: tentar buscar diretamente pelo repositório (caso lista não contenha)
    if (!destino) {
      destino = (await turmaRepository.findById(proximaTurmaId)) as Turma | null;
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
    return await turmaRepository.create(turma);
  },

  atualizar: (id: string, turma: Partial<Omit<Turma, 'id' | 'turmaOriginalId'>>): Promise<void> =>
    turmaRepository.update(id, turma),

  excluir: (id: string): Promise<void> => turmaRepository.delete(id),

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

    const { turmaOriginalId } = turmaVirtual;
    const novaTurmaPayload: Omit<Turma, 'id' | 'turmaOriginalId'> = {
      nome: turmaVirtual.nome,
      anoLetivo: turmaVirtual.anoLetivo,
      turno: turmaVirtual.turno,
    } as any;

    const novaTurmaId = await turmaRepository.create(novaTurmaPayload as any);

    await turmaRepository.update(turmaOriginalId, { isVirtual: false });

    return novaTurmaId;
  }
}
