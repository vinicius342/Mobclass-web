import type { Turma } from '../../models/Turma';
import type { ITurmaRepository } from '../../repositories/ITurmaRepository';

import { FirebaseTurmaRepository } from '../../repositories/FirebaseTurmaRepository';

const turmaRepository: ITurmaRepository = new FirebaseTurmaRepository();

export const turmaService = {
  listarTodas: (): Promise<Turma[]> => turmaRepository.findAll(),

  buscarPorId: (id: string): Promise<Turma | null> => turmaRepository.findById(id),

  listarPorAnoLetivo: async (anoLetivo: string): Promise<Turma[]> => {
    const turmas = await turmaRepository.findAll();
    return turmas.filter(t => t.anoLetivo === anoLetivo);
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

    const { turmaOriginalId, ...turmaSemCamposFrontend } = turmaVirtual;
    const novaTurmaId = await turmaRepository.create(turmaSemCamposFrontend);

    // Marcar turma original como não virtualizável
    await turmaRepository.update(turmaOriginalId, { isVirtual: false });

    return novaTurmaId;
  }
}
