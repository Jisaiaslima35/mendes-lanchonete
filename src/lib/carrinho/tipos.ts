export type CarrinhoOpcao = {
  id: string;
  groupName: string;
  optionName: string;
  priceDelta: number;
};

export type CarrinhoItem = {
  /** Identificador único da linha no carrinho (produto + combinação de opções). */
  lineId: string;
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl: string | null;
  /** Preço efetivo do produto (promo_price ou price) no momento em que foi adicionado. */
  unitPrice: number;
  quantity: number;
  options: CarrinhoOpcao[];
  notes?: string;
};

export type NovoItemCarrinho = Omit<CarrinhoItem, "lineId">;
