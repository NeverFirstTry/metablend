import { countryName } from '@/lib/city-names'

// A place as the reader sees it: the city as the server named it (in the reader's language where it has the
// name) and the country in the reader's language from its ISO code; an answer without a code keeps the
// country name it came with.
export default function PlaceName({ city, cc, country, lang }) {
  const land = countryName(cc, lang, country)
  return <>{city}{land && <span className="text-zinc-400 font-normal">, {land}</span>}</>
}
