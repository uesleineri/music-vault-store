const h2 = 'text-xl font-semibold mt-8 mb-3';
const h3 = 'text-lg font-semibold mt-6 mb-2';
const p = 'mb-4 text-muted-foreground leading-relaxed';
const ul = 'mb-4 list-disc pl-6 space-y-1 text-muted-foreground';
const link = 'text-foreground underline hover:no-underline';

export default function PrivacyPolicy() {
  return (
    <div className="container py-8 max-w-3xl animate-fade-in">
      <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
      <p className="text-sm text-muted-foreground mb-8">Última atualização: 21/07/2026</p>

      <p className={p}>
        Esta política explica quais dados a <strong>Gospel VS</strong> coleta de quem visita ou compra
        na loja, para que servem, com quem são compartilhados e como você pode exercer seus direitos
        sobre eles, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
      </p>

      <h2 className={h2}>1. Quem é o responsável pelos seus dados</h2>
      <p className={p}>
        A Gospel VS é operada por <strong>Ueslei de Souza Neri</strong>, pessoa física, sem CNPJ próprio
        até o momento. Para qualquer assunto relacionado a esta política ou aos seus dados pessoais,
        o canal de contato é: <a className={link} href="mailto:uesleineri1@gmail.com">uesleineri1@gmail.com</a>.
      </p>

      <h2 className={h2}>2. Quais dados coletamos</h2>
      <h3 className={h3}>2.1. Ao finalizar uma compra</h3>
      <ul className={ul}>
        <li><strong>Nome completo</strong> - identificação do comprador e do pagamento.</li>
        <li><strong>E-mail</strong> - envio do link de download e criação automática do acesso à área "Minha Conta".</li>
        <li><strong>CPF</strong> - exigido pelo processador de pagamentos (Asaas) para emitir a cobrança PIX.</li>
        <li><strong>Telefone/WhatsApp</strong> - contato em caso de problema com o pedido.</li>
      </ul>
      <h3 className={h3}>2.2. Ao usar o site</h3>
      <ul className={ul}>
        <li><strong>Itens no carrinho</strong> - guardados apenas no seu navegador (localStorage), nunca enviados aos nossos servidores até você finalizar a compra.</li>
        <li><strong>Sessão de navegação anônima</strong> - um identificador aleatório (sem nenhum dado pessoal) usado só para entender em que etapa do checkout as pessoas desistem, e melhorar a loja.</li>
        <li><strong>Endereço IP e informações do navegador</strong> - registrados em ações administrativas e eventos de pagamento, por segurança e auditoria.</li>
      </ul>
      <h3 className={h3}>2.3. Ao criar uma conta ("Minha Conta")</h3>
      <p className={p}>
        Assim que um pagamento é confirmado, criamos automaticamente um acesso à área "Minha Conta"
        para o e-mail usado na compra, e enviamos um e-mail para você definir sua própria senha. Nós
        nunca criamos, vemos ou armazenamos essa senha em texto simples.
      </p>
      <h3 className={h3}>2.4. Ao avaliar uma compra</h3>
      <p className={p}>
        Se você deixar uma avaliação, o nome que você digitar é exibido publicamente junto com a nota
        e o comentário, depois de aprovada. Seu e-mail não é exibido publicamente em nenhuma
        avaliação.
      </p>

      <h2 className={h2}>3. Com quem compartilhamos seus dados</h2>
      <ul className={ul}>
        <li><strong>Asaas</strong> (processador de pagamentos) - recebe nome, e-mail, CPF e telefone para gerar a cobrança PIX. A Asaas tem sua própria política de privacidade.</li>
        <li><strong>Google Drive</strong> - o arquivo comprado é compartilhado diretamente com o e-mail do comprador; o Google envia sua própria notificação de "arquivo compartilhado com você".</li>
        <li><strong>Supabase</strong> (infraestrutura de banco de dados, autenticação e hospedagem) - processa e armazena os dados acima em nosso nome, como operador de dados.</li>
      </ul>
      <p className={p}>Não vendemos nem alugamos seus dados a ninguém, e não os usamos para publicidade de terceiros.</p>

      <h2 className={h2}>4. Por quanto tempo guardamos seus dados</h2>
      <p className={p}>
        Dados de pedidos (nome, e-mail, valores, CPF) são mantidos pelo prazo exigido pela legislação
        fiscal e civil aplicável no Brasil. Você pode solicitar a exclusão dos demais dados (como sua
        conta em "Minha Conta") a qualquer momento pelo canal de contato acima, respeitadas as
        obrigações legais de guarda de registros de venda.
      </p>

      <h2 className={h2}>5. Seus direitos</h2>
      <p className={p}>Nos termos do art. 18 da LGPD, você pode solicitar, a qualquer momento:</p>
      <ul className={ul}>
        <li>Confirmação de que tratamos seus dados, e acesso a eles;</li>
        <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;</li>
        <li>Portabilidade dos seus dados a outro fornecedor;</li>
        <li>Informação sobre com quem compartilhamos seus dados;</li>
        <li>Revogação do consentimento, quando aplicável.</li>
      </ul>
      <p className={p}>
        Para exercer qualquer um desses direitos, envie um e-mail para{' '}
        <a className={link} href="mailto:uesleineri1@gmail.com">uesleineri1@gmail.com</a>.
      </p>

      <h2 className={h2}>6. Segurança</h2>
      <p className={p}>
        Usamos controles de acesso, criptografia em trânsito e políticas de banco de dados restritivas
        para proteger seus dados. Nenhum sistema é 100% livre de risco, mas nos comprometemos a agir
        rapidamente em caso de qualquer incidente que afete seus dados.
      </p>

      <h2 className={h2}>7. Alterações desta política</h2>
      <p className={p}>
        Podemos atualizar esta política sempre que a loja mudar a forma como trata dados. A data no
        topo da página sempre indica a versão mais recente.
      </p>
    </div>
  );
}
