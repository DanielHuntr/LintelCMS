import type { BoundItem, PageData, ShopProduct } from "@lintel/builder-model";
import { createContext, type ReactNode, useContext } from "react";

/**
 * What a page's dynamic elements read while it is drawn: the page's data (lists, products,
 * the site's menu), the entry an element is being drawn for, and whether this is one of the
 * canvas's extra copies of a collection list's item design.
 */

const PageDataContext = createContext<PageData>({});
const ItemContext = createContext<BoundItem | undefined>(undefined);
const ProductContext = createContext<ShopProduct | undefined>(undefined);
const RepeatedCopyContext = createContext(false);

export function PageDataProvider({ data, children }: { data: PageData; children: ReactNode }) {
  return (
    <PageDataContext.Provider value={data}>
      <ItemContext.Provider value={data.item}>
        <ProductContext.Provider value={data.product}>{children}</ProductContext.Provider>
      </ItemContext.Provider>
    </PageDataContext.Provider>
  );
}

export function usePageData(): PageData {
  return useContext(PageDataContext);
}

export function useCurrentItem(): BoundItem | undefined {
  return useContext(ItemContext);
}

/** Draws `children` (an item design) for one entry, and for one product when it is one. */
export function ForItem({
  item,
  product,
  isCopy = false,
  children,
}: {
  item: BoundItem;
  product?: ShopProduct;
  isCopy?: boolean;
  children: ReactNode;
}) {
  const parentProduct = useContext(ProductContext);
  return (
    <ItemContext.Provider value={item}>
      <ProductContext.Provider value={product ?? parentProduct}>
        <RepeatedCopyContext.Provider value={isCopy}>{children}</RepeatedCopyContext.Provider>
      </ProductContext.Provider>
    </ItemContext.Provider>
  );
}

/**
 * A block's design inside an instance, on the canvas: drawn like copies of an item design,
 * so clicking it selects the instance and its design can't be edited in place.
 */
export function AsBlockCopy({ children }: { children: ReactNode }) {
  return <RepeatedCopyContext.Provider value={true}>{children}</RepeatedCopyContext.Provider>;
}

/** On the canvas, copies of an item design aren't selectable: the first one is. */
export function useIsRepeatedCopy(): boolean {
  return useContext(RepeatedCopyContext);
}

/**
 * The product a shop element shows: the one chosen by handle, else the product of the grid
 * item or product page it is in.
 */
export function useProduct(handle: string): ShopProduct | undefined {
  const data = useContext(PageDataContext);
  const current = useContext(ProductContext);
  if (handle) return data.products?.[handle] ?? sampleProductFor(data, handle);
  return current;
}

function sampleProductFor(data: PageData, handle: string): ShopProduct | undefined {
  return data.productLists
    ? Object.values(data.productLists)
        .flatMap((list) => list.products)
        .find((product) => product.handle === handle)
    : undefined;
}
