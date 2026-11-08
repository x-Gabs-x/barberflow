import TextoLegal from '../components/TextoLegal';
import { TERMOS_DE_USO } from '../legal/textos';

export default function Termos() {
  return <TextoLegal titulo="Termos de Uso" secoes={TERMOS_DE_USO} />;
}