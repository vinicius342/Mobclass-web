import type { Turma } from '../../models/Turma';
import type { ITurmaRepository } from '../../repositories/turma/ITurmaRepository';

import { FirebaseTurmaRepository } from '../../repositories/turma/FirebaseTurmaRepository';
import { db } from '../firebase/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';

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
    return turmas.filter((t: Turma) => t.anoLetivo === anoLetivo);
  },

  listarComVirtualizacao: async (anoLetivo: string): Promise<Turma[]> => {
    const todasTurmas = await turmaRepository.findAll();

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
    const todasTurmas = await turmaRepository.findAll();
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
        // Turma real: buscar no cache ou no repositório
        if (turmasCache) {
          turmaVirtual = turmasCache.find(t => t.id === turmaId);
        }
        
        if (!turmaVirtual) {
          turmaVirtual = (await turmaRepository.findById(turmaId)) || undefined;
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

    // Verificar se já existe uma turma real com o mesmo nome no ano atual
    const turmasReaisQuery = query(
      collection(db, 'turmas'),
      where('nome', '==', turmaVirtual.nome),
      where('anoLetivo', '==', turmaVirtual.anoLetivo)
    );

    const turmasReaisSnap = await getDocs(turmasReaisQuery);

    if (turmasReaisSnap.empty) {
      // Materializar a turma virtual
      const turmaRealId = await turmaService.materializarTurma(turmaVirtual);

      // Copiar vínculos professor-matéria da turma original
      const vinculosOriginaisQuery = query(
        collection(db, 'professores_materias'),
        where('turmaId', '==', turmaVirtual.turmaOriginalId)
      );

      const vinculosOriginaisSnap = await getDocs(vinculosOriginaisQuery);

      for (const vinculoDoc of vinculosOriginaisSnap.docs) {
        const vinculoData = vinculoDoc.data();
        await addDoc(collection(db, 'professores_materias'), {
          professorId: vinculoData.professorId,
          materiaId: vinculoData.materiaId,
          turmaId: turmaRealId
        });
      }

      // Copiar documentos da agenda para o novo turmaId
      const agendasOriginaisQuery = query(
        collection(db, 'agenda'),
        where('turmaId', '==', turmaVirtual.turmaOriginalId)
      );

      const agendasOriginaisSnap = await getDocs(agendasOriginaisQuery);

      for (const agendaDoc of agendasOriginaisSnap.docs) {
        // Pular agendas que estão sendo editadas para evitar duplicação
        if (excluirAgendasIds && excluirAgendasIds.includes(agendaDoc.id)) {
          continue;
        }
        
        const agendaData = agendaDoc.data();
        await addDoc(collection(db, 'agenda'), {
          ...agendaData,
          turmaId: turmaRealId
        });
      }

      return turmaRealId;
    } else {
      // Turma real já existe, usar ela
      return turmasReaisSnap.docs[0].id;
    }
  }
}
