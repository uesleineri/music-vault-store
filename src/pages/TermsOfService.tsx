import { Link } from 'react-router-dom';

const h2 = 'text-xl font-semibold mt-8 mb-3';
const p = 'mb-4 text-muted-foreground leading-relaxed';
const ul = 'mb-4 list-disc pl-6 space-y-1 text-muted-foreground';
const link = 'text-foreground underline hover:no-underline';

export default function TermsOfService() {
  return (
    <div className="container py-8 max-w-3xl animate-fade-in">
      <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
      <p className="text-sm text-muted-foreground mb-8">Última atualização: 21/07/2026</p>

      <p className={p}>
        Estes termos regulam o uso da loja <strong>Gospel VS</strong> e a compra de multitracks e kits
        promocionais. Ao finalizar uma compra, você concorda com o que está descrito aqui e com a{' '}
        <Link className={link} to="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2 className={h2}>1. O que vendemos</h2>
      <p className={p}>
        Vendemos arquivos digitais de multitracks (faixas separadas/stems) de músicas, individualmente
        ou agrupados em kits promocionais com preço fixo. Não vendemos produtos físicos.
      </p>

      <h2 className={h2}>2. Pagamento</h2>
      <p className={p}>
        O pagamento é processado via PIX através da Asaas. O valor mínimo aceito por cobrança é de
        R$ 5,00, exigência do próprio meio de pagamento. Uma compra com vários itens (carrinho ou kit)
        gera uma única cobrança PIX no valor total.
      </p>

      <h2 className={h2}>3. Entrega</h2>
      <p className={p}>
        Após a confirmação do pagamento, você recebe automaticamente:
      </p>
      <ul className={ul}>
        <li>Um link de download válido por 48 horas, enviado por e-mail;</li>
        <li>O compartilhamento direto do arquivo no seu Google Drive (associado ao e-mail informado na compra);</li>
        <li>Acesso à área "Minha Conta", onde o histórico de compras fica disponível mesmo após o link expirar.</li>
      </ul>
      <p className={p}>
        A confirmação do pagamento pode levar alguns minutos. Se não receber o e-mail, verifique a
        caixa de spam antes de entrar em contato.
      </p>

      <h2 className={h2}>4. Direito de arrependimento e reembolso</h2>
      <p className={p}>
        O Código de Defesa do Consumidor garante, em compras feitas fora do estabelecimento físico, o
        direito de desistência em até 7 dias. Como o produto vendido é um arquivo digital entregue
        imediatamente após o pagamento, ao confirmar a compra e efetuar o download você reconhece que
        o conteúdo foi integralmente entregue, o que pode afetar esse direito de desistência conforme
        a legislação aplicável. Problemas com o arquivo (arquivo corrompido, música errada, etc.) serão
        resolvidos diretamente pelo canal de contato abaixo, com reenvio ou reembolso quando cabível.
      </p>

      <h2 className={h2}>5. Uso permitido do conteúdo</h2>
      <p className={p}>
        A compra de um multitrack ou kit dá a você uma licença de uso pessoal/ministerial (ex: uso em
        apresentações, cultos, ensaios). Não é permitido:
      </p>
      <ul className={ul}>
        <li>Revender, redistribuir ou compartilhar publicamente os arquivos comprados;</li>
        <li>Disponibilizar os arquivos em plataformas de compartilhamento ou nuvens públicas;</li>
        <li>Reivindicar autoria sobre as faixas.</li>
      </ul>

      <h2 className={h2}>6. Contas de cliente</h2>
      <p className={p}>
        Ao confirmar seu primeiro pagamento, uma conta em "Minha Conta" é criada automaticamente para
        o e-mail usado na compra, e você recebe um e-mail para definir sua própria senha. Você é
        responsável por manter essa senha em segurança.
      </p>

      <h2 className={h2}>7. Avaliações</h2>
      <p className={p}>
        Só é possível avaliar um produto que você realmente comprou. Toda avaliação passa por
        aprovação antes de aparecer publicamente, e nos reservamos o direito de recusar ou remover
        avaliações com conteúdo ofensivo, falso ou que viole estes termos.
      </p>

      <h2 className={h2}>8. Cupons de desconto</h2>
      <p className={p}>
        Cupons têm validade, valor mínimo de compra e/ou limite de usos definidos a nosso critério, e
        podem ser descontinuados sem aviso prévio.
      </p>

      <h2 className={h2}>9. Alterações e disponibilidade</h2>
      <p className={p}>
        Podemos alterar preços, remover produtos do catálogo ou atualizar estes termos a qualquer
        momento. Alterações não afetam compras já confirmadas.
      </p>

      <h2 className={h2}>10. Lei aplicável</h2>
      <p className={p}>
        Estes termos são regidos pela legislação brasileira. Dúvidas ou reclamações podem ser
        enviadas para <a className={link} href="mailto:uesleineri1@gmail.com">uesleineri1@gmail.com</a>.
      </p>
    </div>
  );
}
