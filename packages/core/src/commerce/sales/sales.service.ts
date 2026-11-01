import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { listMarketRows } from "../markets/markets.repository.js";
import { countUnfulfilledOrders } from "../orders/orders.repository.js";
import { sumDailySales, sumSalesByCurrency } from "./sales.repository.js";
import type { SalesSummary } from "./sales.schema.js";

/**
 * The numbers behind the dashboard's Sales card: money taken (net of refunds, without
 * cancelled orders), orders and the average over the last `days`, per currency, plus one
 * total per day in the primary currency for a small chart.
 */
export async function summariseSales(
  database: DatabaseOrTransaction,
  days: number,
  now: Date,
): Promise<SalesSummary> {
  const since = new Date(now.getTime() - days * 86_400_000);
  const markets = await listMarketRows(database, DEFAULT_TENANT_ID);
  const primaryCurrency =
    (markets.find((market) => market.isPrimary) ?? markets[0])?.currency ?? null;
  const byCurrency = await sumSalesByCurrency(database, since);
  const daily = primaryCurrency ? await sumDailySales(database, since, primaryCurrency) : [];

  return {
    days,
    primaryCurrency,
    byCurrency: byCurrency.map((row) => ({
      currency: row.currency,
      sales: { amount: row.amount, currency: row.currency },
      orderCount: row.orderCount,
      averageOrder: {
        amount: row.orderCount > 0 ? Math.round(row.amount / row.orderCount) : 0,
        currency: row.currency,
      },
    })),
    daily: daily.map((row) => ({
      date: row.date,
      sales: { amount: row.amount, currency: primaryCurrency ?? "" },
      orderCount: row.orderCount,
    })),
    ordersToFulfil: await countUnfulfilledOrders(database),
  };
}
