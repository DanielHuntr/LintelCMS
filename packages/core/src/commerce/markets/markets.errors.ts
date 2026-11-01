import { HttpError } from "../../http/http-errors.js";
import { countryName } from "../money/currencies.js";

export class CountryInAnotherMarketError extends HttpError {
  constructor(country: string, marketName: string) {
    super(
      409,
      "COUNTRY_IN_ANOTHER_MARKET",
      `${countryName(country)} is already in the ${marketName} market. A country can only be in one market.`,
      { fields: { countries: `${countryName(country)} is already in ${marketName}` } },
    );
  }
}

export class PrimaryMarketRequiredError extends HttpError {
  constructor() {
    super(
      400,
      "PRIMARY_MARKET_REQUIRED",
      "This is your primary market, so it can't be deleted. Make another market primary first.",
    );
  }
}

export class NoMarketsError extends HttpError {
  constructor() {
    super(
      409,
      "SHOP_NOT_READY",
      "The shop doesn't sell anywhere yet. Add a market in Shop → Settings → Markets first.",
    );
  }
}
