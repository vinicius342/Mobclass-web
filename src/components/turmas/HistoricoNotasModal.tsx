import React, { useMemo } from 'react';
import { Modal, Table, Card } from 'react-bootstrap';
import { BookOpen } from 'lucide-react';
import { NotaService } from '../../services/data/NotaService';

interface DadosBoletim {
  materias: string[];
  bimestres: string[];
  notas: Record<string, Record<string, { mediaFinal?: number }>>;
}
interface HistoricoAluno {
  nome: string;
  dadosBoletim?: DadosBoletim;
  notas: any[];
}

interface Props {
  show: boolean;
  onHide: () => void;
  historicoAluno: HistoricoAluno | null;
  setShowHistorico: (v: boolean) => void;
  getNotaColorUtil: (n?: number) => string;
}

const HistoricoNotasModal: React.FC<Props> = ({ show, onHide, historicoAluno, getNotaColorUtil }) => {
  // Inicializar NotaService (apenas para cálculos locais, sem acesso direto ao Firebase)
  const notaService = useMemo(
    () => new NotaService(),
    []
  );

  const dados = historicoAluno?.dadosBoletim;

  return (
    <Modal show={show} onHide={onHide} centered className="historico-modal" size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          Histórico de Notas - {historicoAluno?.nome}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-none d-md-block" style={{ overflowX: 'auto' }}>
          {dados ? (
            <Table bordered size="sm" className="mb-0" style={{ minWidth: 600, fontSize: '1rem', textAlign: 'center', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
              <thead className="fw-bold text-muted align-middle" style={{ background: '#f8f9fa' }}>
                <tr>
                  <th style={{ width: '20%' }}>Matéria</th>
                  {dados.bimestres.map((bimestre: string) => (
                    <th key={bimestre} style={{ minWidth: '100px' }}>{bimestre} Bim</th>
                  ))}
                  <th style={{ minWidth: '100px', background: '#e9ecef' }}>Média Final</th>
                </tr>
              </thead>
              <tbody>
                {dados.materias.map((materia: string) => {
                  const notasBimestres = dados.bimestres
                    .map((bim: string) => dados.notas[bim]?.[materia]?.mediaFinal);
                  const mediaFinalMateria = notaService.calcularMediaPorMateria(notasBimestres);
                  return (
                    <tr key={materia}>
                      <td style={{ fontWeight: 600, background: '#f8f9fa', textAlign: 'center', paddingLeft: 0 }}>{materia}</td>
                      {dados.bimestres.map((bimestre: string) => {
                        const nota = dados.notas[bimestre]?.[materia];
                        const mediaFinal = nota?.mediaFinal;
                        return (
                          <td key={bimestre} className={`fw-bold ${getNotaColorUtil(mediaFinal)}`} style={{ fontSize: '1rem', padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                            {mediaFinal !== null && mediaFinal !== undefined ? Number(mediaFinal).toFixed(1) : '-'}
                          </td>
                        );
                      })}
                      <td className={`fw-bold ${getNotaColorUtil(mediaFinalMateria ? parseFloat(mediaFinalMateria) : undefined)}`} style={{ fontSize: '1.1rem', padding: '6px 4px', background: '#e9ecef', textAlign: 'center', verticalAlign: 'middle' }}>
                        {mediaFinalMateria !== null && mediaFinalMateria !== undefined ? Number(mediaFinalMateria).toFixed(1) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <div className="text-center py-4">
              <BookOpen size={48} className="mb-3 text-muted opacity-50" />
              <p className="text-muted mb-0">Nenhuma nota encontrada para este aluno.</p>
            </div>
          )}
        </div>
        <div className="d-block d-md-none">
          {dados ? (
            <div>
              {dados.materias.map((materia: string) => (
                <Card key={materia} className="mb-3">
                  <Card.Header className="bg-primary text-white">
                    <h6 className="mb-0">{materia}</h6>
                  </Card.Header>
                  <Card.Body className="p-2">
                    <div className="row g-2">
                      {dados.bimestres.map((bimestre: string) => {
                        const nota = dados.notas[bimestre]?.[materia];
                        const mediaFinal = nota?.mediaFinal;
                        return (
                          <div key={bimestre} className="col-6">
                            <div className="border rounded p-2 text-center">
                              <small className="text-muted d-block">{bimestre} Bim</small>
                              <span className={`fw-bold fs-5 ${getNotaColorUtil(mediaFinal)}`}>{mediaFinal !== null && mediaFinal !== undefined ? Number(mediaFinal).toFixed(1) : '-'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <BookOpen size={48} className="mb-3 text-muted opacity-50" />
              <p className="text-muted mb-0">Nenhuma nota encontrada para este aluno.</p>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default HistoricoNotasModal;
