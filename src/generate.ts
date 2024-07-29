import fs from 'fs'
import path from 'path'
import type { CountryDataType } from '../index'

async function generate() {
	const countries = await fetchJson<
		{
			name: string
			iso_3166_2: string
			iso_3166_3: string
			measurement_system: 'metric' | 'imperial'
			default_currency: string
			default_language: string
			languages: string[]
			timezones: string[] // Mostly empty for some reason
		}[]
	>('https://raw.githubusercontent.com/flowcommerce/json-reference/main/data/final/countries.json')

	const countriesAdditionalInfo = await fetchJson<
		Record<
			string,
			{
				name: string
				native: string
				phone: number[]
				continent: string
				capital: string
				currency: string[]
				languages: string[]
			}
		>
	>('https://raw.githubusercontent.com/annexare/Countries/main/dist/countries.min.json')

	const timezones = await fetchJson<
		{
			timezones: string[]
			latlng: [number, number]
			name: string
			country_code: string
			capital: string
		}[]
	>(
		'https://gist.githubusercontent.com/erdem/8c7d26765831d0f9a8c62f02782ae00d/raw/248037cd701af0a4957cce340dabb0fd04e38f4c/countries.json',
	)

	const currencies = await fetchJson<
		{
			name: string
			iso_4217_3: string
			number_decimals: number
			symbols: {
				primary: string
				narrow?: string
			}
			default_locale: string
		}[]
	>('https://raw.githubusercontent.com/flowcommerce/json-reference/main/data/final/currencies.json')

	const boundingBoxes = await fetchJson<
		Record<
			string,
			{
				sw: {
					lat: number
					lon: number
				}
				ne: {
					lat: number
					lon: number
				}
			}
		>
	>(
		'https://gist.githubusercontent.com/botzill/fc2a1581873200739f6dc5c1daf85a7d/raw/002372a57a40f299a463122c039faf9f927b13fe/countries_bbox.json',
	)

	const salexTaxes = await fetchJson<
		Record<
			string,
			{
				type: 'vat' | 'gst' | 'none'
				currency: string
				rate: number
				before: Record<
					string,
					{
						type: 'vat' | 'gst' | 'none'
						currency: string
						rate: number
					}
				>
			}
		>
	>('https://raw.githubusercontent.com/valeriansaliou/node-sales-tax/master/res/sales_tax_rates.json')

	const allCountryData: CountryDataType[] = countries
		.map((country) => {
			const tz = timezones.find((c) => c.country_code === country.iso_3166_2)
			const currency = currencies.find((c) => c.iso_4217_3 === country.default_currency)?.symbols
			const bbox = boundingBoxes[country.iso_3166_3] || null
			const tax = salexTaxes[country.iso_3166_2] || null
			const callingCode = countriesAdditionalInfo[country.iso_3166_2].phone[0].toString()

			return {
				name: country.name,
				native: countriesAdditionalInfo[country.iso_3166_2].native,
				code: country.iso_3166_2,
				callingCode: resolveCallingCode(callingCode),
				isMetricSystem: country.measurement_system === 'metric',
				defaultLanguage: country.default_language || null,
				languages: country.languages,
				timezones: tz ? tz.timezones || [] : [],
				currency: currency ? currency.narrow || currency.primary : '',
				salesTax: tax
					? { type: tax.type === 'none' ? null : tax.type, rate: tax.rate }
					: { type: null, rate: 0 },
				boundingBoxSW: bbox ? [bbox.sw.lat, bbox.sw.lon] : [],
				boundingBoxNE: bbox ? [bbox.ne.lat, bbox.ne.lon] : [],
			}
		})
		.sort((a, b) => new Intl.Collator().compare(a.name, b.name))
		.filter((country) => country.boundingBoxSW.length && country.boundingBoxNE.length)

	createFile(allCountryData)
}

function resolveCallingCode(callingCode: string) {
	// Slice long calling codes if needed.
	// More info: https://countrycode.org
	if (callingCode.length > 3) {
		// example: Bahamas "1242" (1242) should be "1"
		if (callingCode.startsWith('1')) {
			return callingCode.slice(0, 1)
		}

		// example: Svalbard and Jan Mayen "4779" (47-79) should be "47"
		if (callingCode.startsWith('4')) {
			return callingCode.slice(0, 2)
		}

		// example: Bonaire "5997" (599-7) should be "599"
		if (callingCode.startsWith('5')) {
			return callingCode.slice(0, 3)
		}
	}

	return callingCode
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url)

	if (!response.ok) {
		throw new Error(`An error has occured: ${response.status} ${url}`)
	}

	const jsonData = await response.json()

	return jsonData
}

async function createFile(data: CountryDataType[]) {
	const jsonString = JSON.stringify(data, null, 4)

	const distPath = path.join(__dirname, '..', 'dist')
	const filePath = path.join(distPath, 'countries.json')

	if (!fs.existsSync(distPath)) {
		fs.mkdirSync(distPath)
	}

	fs.writeFile(filePath, jsonString, (err) => {
		if (err) {
			console.error('Error writing file:', err)
		} else {
			console.log('File has been written successfully to /dist/countries.json')
		}
	})
}

generate()
