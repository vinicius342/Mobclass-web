// src/pages/Frequencia.tsx - Corrigido para usar professores_materias
import { JSX, useEffect, useState } from 'react';
import {
  Container, Toast, ToastContainer
} from 'react-bootstrap';

import { CheckSquare } from "lucide-react";

import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { useAnoLetivoAtual } from '../hooks/useAnoLetivoAtual';
import { turmaService } from '../services/data/TurmaService';
import { MateriaService } from '../services/data/MateriaService';
import { ProfessorMateriaService } from '../services/data/ProfessorMateriaService';
import { FirebaseMateriaRepository } from '../repositories/materia/FirebaseMateriaRepository';
import { FirebaseProfessorMateriaRepository } from '../repositories/professor_materia/FirebaseProfessorMateriaRepository';
import type { Turma } from '../models/Turma';
import type { ProfessorMateria } from '../models/ProfessorMateria';
import type { Materia } from '../models/Materia';
import FrequenciaLancamento from '../components/frequencia/FrequenciaLancamento';

// Instanciar services
const materiaRepository = new FirebaseMateriaRepository();
const materiaService = new MateriaService(materiaRepository);

const professorMateriaRepository = new FirebaseProfessorMateriaRepository();
const professorMateriaService = new ProfessorMateriaService(professorMateriaRepository);
import FrequenciaRelatorios from '../components/frequencia/FrequenciaRelatorios';

export default function Frequencia(): JSX.Element {
  const { userData } = useAuth()!;
  const { anoLetivo } = useAnoLetivoAtual();
  const isAdmin = userData?.tipo === 'administradores';

  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [vinculos, setVinculos] = useState<ProfessorMateria[]>([]);

  const [toast, setToast] = useState<{ show: boolean; message: string; variant: 'success' | 'danger' | 'warning' }>({ show: false, message: '', variant: 'success' });

  useEffect(() => {
    async function fetchData() {
      if (isAdmin) {
        const [turmas, materias] = await Promise.all([
          turmaService.listarPorAnoLetivo(anoLetivo.toString()),
          materiaService.listar()
        ]);
        setTurmas(turmas.sort((a, b) => a.nome.localeCompare(b.nome)));
        setMaterias(materias);
      } else {
        if (!userData) return;
        const vincList = await professorMateriaService.listarPorProfessor(userData.uid);
        setVinculos(vincList);

        const turmaIds = [...new Set(vincList.map((v: ProfessorMateria) => v.turmaId))];
        const todasTurmas = await turmaService.listarPorAnoLetivo(anoLetivo.toString());
        const turmasFiltradas = todasTurmas.filter((t: Turma) => turmaIds.includes(t.id));
        setTurmas(turmasFiltradas.sort((a, b) => a.nome.localeCompare(b.nome)));

        const materiaIds = [...new Set(vincList.map((v: ProfessorMateria) => v.materiaId))];
        const todasMaterias = await materiaService.listar();
        const materiasFiltradas = todasMaterias.filter((m: Materia) => materiaIds.includes(m.id));
        setMaterias(materiasFiltradas);
      }
    }
    fetchData();
  }, [userData, anoLetivo, isAdmin]);

  // Tabs
  const [activeTab, setActiveTab] = useState<'lancamento-frequencia' | 'relatorios-frequencia'>('lancamento-frequencia');

  return (
    <AppLayout>
      <Container className="my-4">

        <div className="border-gray-200 mb-3">
          {/* Header */}
          <div className="mb-4 px-1">
            <div className="d-flex align-items-center gap-2 mb-1">
              <CheckSquare size={32} color="#2563eb" style={{ minWidth: 32, minHeight: 32 }} />
              <h1
                className="fw-bold mb-0"
                style={{
                  fontSize: '2rem',
                  background: 'linear-gradient(135deg, #1e293b 0%, #2563eb 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                Gestão de Frequência Escolar
              </h1>
            </div>
            <p className="mb-0" style={{ color: '#3b4861', marginLeft: 44, fontSize: 16 }}>
              Gerencie presenças, ausências e relatórios
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="container px-0 d-none d-md-block">
          <div className="d-flex py-3">
            <div className="w-100 custom-tabs-container">
              <button
                className={`custom-tab ${activeTab === 'lancamento-frequencia' ? 'active' : ''}`}
                onClick={() => setActiveTab('lancamento-frequencia')}
                type="button"
                style={{ flex: 1 }}
              >
                Lançamento de Frequência
              </button>
              <button
                className={`custom-tab ${activeTab === 'relatorios-frequencia' ? 'active' : ''}`}
                onClick={() => setActiveTab('relatorios-frequencia')}
                type="button"
                style={{ flex: 1 }}
              >
                Relatórios de Frequência
              </button>
            </div>
          </div>
        </div>

        {/* Mobile navigation Tabs */}
        <div className="container px-0 d-block d-md-none">
          <div className="d-flex py-3">
            <div className="w-100 custom-tabs-container">
              <button
                className={`custom-tab ${activeTab === 'lancamento-frequencia' ? 'active' : ''}`}
                onClick={() => setActiveTab('lancamento-frequencia')}
                type="button"
                style={{ flex: 1 }}
              >
                Lançamento
              </button>
              <button
                className={`custom-tab ${activeTab === 'relatorios-frequencia' ? 'active' : ''}`}
                onClick={() => setActiveTab('relatorios-frequencia')}
                type="button"
                style={{ flex: 1 }}
              >
                Relatórios
              </button>
            </div>
          </div>
        </div>

        {/* Main Content*/}
        <div className="pb-0">
          {activeTab === 'lancamento-frequencia' ? (
            <FrequenciaLancamento
              turmas={turmas}
              materias={materias}
              vinculos={vinculos}
              isAdmin={isAdmin}
              userData={userData}
            />
          ) : (
            <FrequenciaRelatorios
              turmas={turmas}
              materias={materias}
              onToast={(message, variant) => setToast({ show: true, message, variant })}
            />
          )}
        </div>

        <ToastContainer position="bottom-end" className="p-3">
          <Toast
            show={toast.show}
            bg={toast.variant}
            onClose={() => setToast(prev => ({ ...prev, show: false }))}
            delay={3000}
            autohide
          >
            <Toast.Body className="text-white">{toast.message}</Toast.Body>
          </Toast>
        </ToastContainer>
      </Container>
    </AppLayout>
  );
}
