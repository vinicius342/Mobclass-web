// src/components/Paginacao.tsx
import { Pagination } from 'react-bootstrap';

interface Props {
  paginaAtual: number;
  totalPaginas: number;
  aoMudarPagina: (pagina: number) => void;
}

export default function Paginacao({ paginaAtual, totalPaginas, aoMudarPagina }: Props) {
  if (totalPaginas <= 1) return null;

  const gerarPaginas = () => {
    const delta = 2;
    const range: (number | string)[] = [];

    for (let i = Math.max(2, paginaAtual - delta); i <= Math.min(totalPaginas - 1, paginaAtual + delta); i++) {
      range.push(i);
    }

    if (paginaAtual - delta > 2) {
      range.unshift('...');
    }
    if (paginaAtual + delta < totalPaginas - 1) {
      range.push('...');
    }

    range.unshift(1);
    if (totalPaginas > 1) range.push(totalPaginas);

    return range;
  };

  return (
    <Pagination className="justify-content-center mt-3">
      <Pagination.First onClick={() => aoMudarPagina(1)} disabled={paginaAtual === 1} />
      <Pagination.Prev onClick={() => aoMudarPagina(paginaAtual - 1)} disabled={paginaAtual === 1} />

      {gerarPaginas().map((num, i) =>
        num === '...' ? (
          <Pagination.Ellipsis key={`ellipsis-${i}`} disabled />
        ) : (
          <Pagination.Item
            key={`page-${num}`}
            active={num === paginaAtual}
            onClick={() => aoMudarPagina(Number(num))}
          >
            {num}
          </Pagination.Item>
        )
      )}

      <Pagination.Next onClick={() => aoMudarPagina(paginaAtual + 1)} disabled={paginaAtual === totalPaginas} />
      <Pagination.Last onClick={() => aoMudarPagina(totalPaginas)} disabled={paginaAtual === totalPaginas} />
    </Pagination>
  );
}

