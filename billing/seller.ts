/**
 * Who issues the invoices.
 *
 * These are the details an invoice must carry of the seller. They are copied
 * onto every invoice when it is issued, so a later change here does not
 * rewrite an invoice that exists.
 */

export interface Seller {
  name:        string;
  addressLine: string;
  postalCode:  string;
  city:        string;
  country:     string;
  /** Chamber of Commerce number. */
  kvk:         string;
  vatNumber:   string;
  email:       string;
  website:     string;
}

export const SELLER: Seller = {
  name:        "Mister Chameleon B.V.",
  addressLine: "Gildetrom 35",
  postalCode:  "3905 TB",
  city:        "Veenendaal",
  country:     "NL",
  kvk:         "54286093",
  vatNumber:   "NL851242893B02",
  email:       "info@misterchameleon.nl",
  website:     "www.misterchameleon.nl",
};
