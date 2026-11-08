import TextoLegal from '../components/TextoLegal';
import { AVISO_DE_PRIVACIDADE, AVISO_INTRODUCAO } from '../legal/textos';

export default function Privacidade() {
  return (
    <TextoLegal
      titulo="Aviso de Privacidade"
      introducao={AVISO_INTRODUCAO}
      secoes={AVISO_DE_PRIVACIDADE}
    />
  );
}