export type CountryDataType = {
	name: string
	native: string
	code: string
	callingCode: string
	defaultLanguage: string | null
	languages: string[]
	timezones: string[]
	currency: string
	boundingBoxSW: number[]
	boundingBoxNE: number[]
	salesTax: SalesTax
	isMetricSystem: boolean
}

type SalesTax = {
	type: "vat" | "gst" | null
	rate: number
}

declare const countries: CountryDataType[]

export = countries
