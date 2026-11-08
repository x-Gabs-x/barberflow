export const VERSAO_TERMOS = '2026-11-08';

export type Secao = {
  titulo: string;
  texto?: string;
  itens?: { destaque: string; texto: string }[];
};

export const TERMOS_DE_USO: Secao[] = [
  {
    titulo: '1. Aceite',
    texto:
      'Ao criar uma conta no BarberFlow, você declara que leu e concorda com estes termos e com o Aviso de Privacidade. Sem esse aceite, não é possível usar o sistema. O sistema é destinado a maiores de 18 anos.',
  },
  {
    titulo: '2. O que é o sistema',
    texto:
      'O BarberFlow ajuda barbearias a registrar atendimentos, conferir comprovantes de pagamento, fechar o dia e calcular o repasse de cada barbeiro parceiro. Ele não processa pagamentos: apenas registra a forma de pagamento informada e o comprovante anexado.',
  },
  {
    titulo: '3. Cadastro e perfis',
    texto:
      'Há três perfis: dono, parceiro e recepção. O dono cria a barbearia no próprio cadastro. Parceiro e recepção entram com o ID da barbearia e só acessam o sistema depois que o dono aprova o pedido. Você deve informar dados verdadeiros e completos. O CPF só pode estar ligado a uma conta, e o e-mail precisa ser confirmado por código. O dono pode ter mais de uma barbearia (filiais) com o mesmo CPF e a mesma conta, e os dados de cada filial ficam separados. Parceiro e recepção pertencem a uma única barbearia.',
  },
  {
    titulo: '4. Sua conta',
    texto:
      'O login é feito com CPF e senha. A senha é pessoal e não deve ser compartilhada. Você é responsável pelo que for feito com a sua conta. O ID da barbearia é confidencial e deve ser passado apenas a quem o dono quer na equipe.',
  },
  {
    titulo: '5. Regras de uso',
    texto:
      'Você se compromete a registrar apenas atendimentos reais, anexar comprovantes verdadeiros e não alterar valores, horários ou comprovantes para obter vantagem. É proibido tentar acessar dados de outras barbearias ou de outros perfis sem permissão.',
  },
  {
    titulo: '6. Responsabilidades do dono',
    texto:
      'O dono define os serviços, os preços, o horário de funcionamento e o escote de cada barbeiro (e o próprio), aprova ou recusa pedidos de entrada, valida o fechamento do dia e decide quem fica na equipe. Os dados dos clientes cadastrados no sistema são tratados pela barbearia, e o dono responde por eles perante os clientes.',
  },
  {
    titulo: '7. Validação e fechamento',
    texto:
      'Um atendimento só entra no fechamento depois de validado pela recepção e, em seguida, pelo dono. Atendimentos sem comprovante não podem ser validados. Depois do fechamento do dia, os valores são definitivos.',
  },
  {
    titulo: '8. Remoção e suspensão',
    texto:
      'O dono pode remover qualquer parceiro ou recepção. A pessoa removida perde o acesso, mas o histórico dos atendimentos é mantido para fins de controle financeiro. Contas usadas para fraude podem ser suspensas.',
  },
  {
    titulo: '9. Disponibilidade',
    texto:
      'O sistema é oferecido em versão inicial, sem garantia de funcionamento ininterrupto. Podemos ajustar ou interromper funcionalidades, avisando quando possível.',
  },
  {
    titulo: '10. Alterações',
    texto: 'Estes termos podem mudar. Quando houver mudança relevante, pediremos um novo aceite.',
  },
  {
    titulo: '11. Contato e foro',
    texto: 'Dúvidas: g.nathan14@outlook.com. Foro: Campina Grande/PB.',
  },
  {
    titulo: '12. Projeto acadêmico e fase de testes',
    texto:
      'O BarberFlow é desenvolvido como projeto acadêmico por estudantes da UNIFACISA e está em fase de testes. Nesse período, os dados cadastrados podem ser apagados ou reiniciados, e o sistema não deve ser o único registro financeiro da barbearia.',
  },
];

export const AVISO_INTRODUCAO =
  'Este aviso explica como o BarberFlow trata dados pessoais, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).';

export const AVISO_DE_PRIVACIDADE: Secao[] = [
  {
    titulo: '1. Quem trata os dados',
    texto:
      'Para os dados de quem usa o sistema (dono, parceiro e recepção), o responsável é a equipe do projeto BarberFlow (estudantes da UNIFACISA). Para os dados dos clientes da barbearia, a barbearia é a responsável (controladora) e o BarberFlow atua como operador, seguindo as instruções do dono. Contato para assuntos de privacidade: g.nathan14@outlook.com.',
  },
  {
    titulo: '2. Dados que coletamos',
    itens: [
      {
        destaque: 'De quem usa o sistema:',
        texto:
          'nome completo, CPF, e-mail, telefone, senha (guardada de forma protegida, nunca em texto aberto), perfil, foto de perfil (opcional), data do cadastro e data do aceite destes termos.',
      },
      {
        destaque: 'Da barbearia:',
        texto:
          'nome, data de início, horário de funcionamento, ID da barbearia e, se o dono quiser, telefone e cidade.',
      },
      {
        destaque: 'Dos atendimentos:',
        texto:
          'cliente (CPF, nome e telefone), serviços, valor, início e fim, observações, forma de pagamento e comprovantes (imagens ou número da maquininha). Comprovantes podem conter dados de terceiros, como nome e conta de quem pagou.',
      },
      {
        destaque: 'De controle:',
        texto: 'quem registrou, validou ou alterou cada atendimento, e quando.',
      },
    ],
  },
  {
    titulo: '3. Para que usamos',
    texto:
      'Para criar e proteger sua conta, confirmar seu e-mail, controlar o acesso por perfil, registrar e conferir atendimentos, calcular repasses, gerar o fechamento e relatórios do dono, e prevenir fraudes.',
  },
  {
    titulo: '4. Base legal',
    texto:
      'Usamos seus dados para executar o serviço que você pediu ao criar a conta (execução de contrato), para proteger o sistema e prevenir fraudes (legítimo interesse) e, no caso da foto de perfil e do aceite destes termos, com o seu consentimento, que você pode retirar quando quiser.',
  },
  {
    titulo: '5. Com quem compartilhamos',
    texto:
      'Dentro da mesma barbearia, cada perfil vê apenas o necessário: o barbeiro vê os próprios atendimentos e o que tem a receber; a recepção vê os atendimentos e comprovantes do dia; o dono vê tudo da própria barbearia, incluindo os dados de quem pediu para entrar. Nunca mostramos dados de uma barbearia a outra. Usamos provedores para guardar dados e enviar e-mails (banco de dados, autenticação, armazenamento de arquivos e envio de e-mail), que tratam os dados apenas para prestar o serviço. Não vendemos dados pessoais.',
  },
  {
    titulo: '6. Por quanto tempo guardamos',
    texto:
      'Enquanto a conta existir e por prazo indeterminado. Quando uma pessoa é removida ou pede a exclusão da conta, os dados pessoais dela são apagados ou anonimizados, mas o histórico financeiro dos atendimentos (valores, datas e comprovantes) pode ser mantido pela barbearia para controle e obrigações legais.',
  },
  {
    titulo: '7. Seus direitos',
    texto:
      'Você pode pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização, bloqueio ou eliminação, portabilidade, informação sobre com quem compartilhamos e a retirada do consentimento. Peça por g.nathan14@outlook.com. Pedidos sobre dados de clientes devem ser feitos à barbearia.',
  },
  {
    titulo: '8. Segurança',
    texto:
      'A comunicação usa conexão criptografada, as senhas são protegidas, e o acesso aos dados é separado por barbearia e por perfil. Nenhum sistema é totalmente imune a falhas; se houver um incidente que possa afetar você, avisaremos.',
  },
  {
    titulo: '9. Mudanças neste aviso',
    texto:
      'Se o aviso mudar de forma relevante, mostraremos a nova versão e pediremos novo aceite.',
  },
];