// Zabasearch Scraper - Supports name and phone searches
import {
  BaseScraper,
  PersonProfile,
  ProfileMatch,
  QuickScanProfileData,
  SearchInput,
  SearchType,
  createEmptyProfileData,
} from "./BaseScraper.ts";

export class ZabasearchScraper extends BaseScraper {
  name = "Zabasearch";
  supportedSearchTypes: SearchType[] = ["name", "phone"];

  // Free CORS proxies for bypassing restrictions
  private corsProxies = [
    "https://corsproxy.io/?",
    "https://api.codetabs.com/v1/proxy?quest=",
    "https://api.allorigins.win/raw?url=",
  ];

  // ZIP code to state mapping (first 3 digits)
  private static zipToState: { [key: string]: string } = {
    "005": "New York", "006": "Puerto Rico", "007": "Puerto Rico", "008": "Virgin Islands",
    "009": "Puerto Rico", "010": "Massachusetts", "011": "Massachusetts", "012": "Massachusetts",
    "013": "Massachusetts", "014": "Massachusetts", "015": "Massachusetts", "016": "Massachusetts",
    "017": "Massachusetts", "018": "Massachusetts", "019": "Massachusetts", "020": "Massachusetts",
    "021": "Massachusetts", "022": "Massachusetts", "023": "Massachusetts", "024": "Massachusetts",
    "025": "Massachusetts", "026": "Massachusetts", "027": "Massachusetts", "028": "Rhode Island",
    "029": "Rhode Island", "030": "New Hampshire", "031": "New Hampshire", "032": "New Hampshire",
    "033": "New Hampshire", "034": "New Hampshire", "035": "New Hampshire", "036": "New Hampshire",
    "037": "New Hampshire", "038": "New Hampshire", "039": "Maine", "040": "Maine",
    "041": "Maine", "042": "Maine", "043": "Maine", "044": "Maine", "045": "Maine",
    "046": "Maine", "047": "Maine", "048": "Maine", "049": "Maine", "050": "Vermont",
    "051": "Vermont", "052": "Vermont", "053": "Vermont", "054": "Vermont", "055": "Massachusetts",
    "056": "Vermont", "057": "Vermont", "058": "Vermont", "059": "Vermont", "060": "Connecticut",
    "061": "Connecticut", "062": "Connecticut", "063": "Connecticut", "064": "Connecticut",
    "065": "Connecticut", "066": "Connecticut", "067": "Connecticut", "068": "Connecticut",
    "069": "Connecticut", "070": "New Jersey", "071": "New Jersey", "072": "New Jersey",
    "073": "New Jersey", "074": "New Jersey", "075": "New Jersey", "076": "New Jersey",
    "077": "New Jersey", "078": "New Jersey", "079": "New Jersey", "080": "New Jersey",
    "081": "New Jersey", "082": "New Jersey", "083": "New Jersey", "084": "New Jersey",
    "085": "New Jersey", "086": "New Jersey", "087": "New Jersey", "088": "New Jersey",
    "089": "New Jersey", "100": "New York", "101": "New York", "102": "New York",
    "103": "New York", "104": "New York", "105": "New York", "106": "New York",
    "107": "New York", "108": "New York", "109": "New York", "110": "New York",
    "111": "New York", "112": "New York", "113": "New York", "114": "New York",
    "115": "New York", "116": "New York", "117": "New York", "118": "New York",
    "119": "New York", "120": "New York", "121": "New York", "122": "New York",
    "123": "New York", "124": "New York", "125": "New York", "126": "New York",
    "127": "New York", "128": "New York", "129": "New York", "130": "New York",
    "131": "New York", "132": "New York", "133": "New York", "134": "New York",
    "135": "New York", "136": "New York", "137": "New York", "138": "New York",
    "139": "New York", "140": "New York", "141": "New York", "142": "New York",
    "143": "New York", "144": "New York", "145": "New York", "146": "New York",
    "147": "New York", "148": "New York", "149": "New York", "150": "Pennsylvania",
    "151": "Pennsylvania", "152": "Pennsylvania", "153": "Pennsylvania", "154": "Pennsylvania",
    "155": "Pennsylvania", "156": "Pennsylvania", "157": "Pennsylvania", "158": "Pennsylvania",
    "159": "Pennsylvania", "160": "Pennsylvania", "161": "Pennsylvania", "162": "Pennsylvania",
    "163": "Pennsylvania", "164": "Pennsylvania", "165": "Pennsylvania", "166": "Pennsylvania",
    "167": "Pennsylvania", "168": "Pennsylvania", "169": "Pennsylvania", "170": "Pennsylvania",
    "171": "Pennsylvania", "172": "Pennsylvania", "173": "Pennsylvania", "174": "Pennsylvania",
    "175": "Pennsylvania", "176": "Pennsylvania", "177": "Pennsylvania", "178": "Pennsylvania",
    "179": "Pennsylvania", "180": "Pennsylvania", "181": "Pennsylvania", "182": "Pennsylvania",
    "183": "Pennsylvania", "184": "Pennsylvania", "185": "Pennsylvania", "186": "Pennsylvania",
    "187": "Pennsylvania", "188": "Pennsylvania", "189": "Pennsylvania", "190": "Pennsylvania",
    "191": "Pennsylvania", "192": "Pennsylvania", "193": "Pennsylvania", "194": "Pennsylvania",
    "195": "Pennsylvania", "196": "Pennsylvania", "200": "District of Columbia",
    "201": "Virginia", "202": "District of Columbia", "203": "District of Columbia",
    "204": "District of Columbia", "205": "District of Columbia", "206": "Maryland",
    "207": "Maryland", "208": "Maryland", "209": "Maryland", "210": "Maryland",
    "211": "Maryland", "212": "Maryland", "213": "Maryland", "214": "Maryland",
    "220": "Virginia", "221": "Virginia", "222": "Virginia", "223": "Virginia",
    "224": "Virginia", "225": "Virginia", "226": "Virginia", "227": "Virginia",
    "228": "Virginia", "229": "Virginia", "230": "Virginia", "231": "Virginia",
    "232": "Virginia", "233": "Virginia", "234": "Virginia", "235": "Virginia",
    "236": "Virginia", "237": "Virginia", "238": "Virginia", "239": "Virginia",
    "240": "Virginia", "241": "Virginia", "242": "Virginia", "243": "Virginia",
    "244": "Virginia", "245": "Virginia", "246": "Virginia", "247": "West Virginia",
    "248": "West Virginia", "250": "West Virginia", "251": "West Virginia",
    "252": "West Virginia", "253": "West Virginia", "254": "West Virginia",
    "255": "West Virginia", "256": "West Virginia", "257": "West Virginia",
    "258": "West Virginia", "259": "West Virginia", "260": "West Virginia",
    "261": "West Virginia", "262": "West Virginia", "263": "West Virginia",
    "264": "West Virginia", "265": "West Virginia", "266": "West Virginia",
    "267": "West Virginia", "268": "West Virginia", "270": "North Carolina",
    "271": "North Carolina", "272": "North Carolina", "273": "North Carolina",
    "274": "North Carolina", "275": "North Carolina", "276": "North Carolina",
    "277": "North Carolina", "278": "North Carolina", "279": "North Carolina",
    "280": "North Carolina", "281": "North Carolina", "282": "North Carolina",
    "283": "North Carolina", "284": "North Carolina", "285": "North Carolina",
    "286": "North Carolina", "287": "North Carolina", "288": "North Carolina",
    "289": "North Carolina", "290": "South Carolina", "291": "South Carolina",
    "292": "South Carolina", "293": "South Carolina", "294": "South Carolina",
    "295": "South Carolina", "296": "South Carolina", "297": "South Carolina",
    "298": "South Carolina", "299": "South Carolina", "300": "Georgia", "301": "Georgia",
    "302": "Georgia", "303": "Georgia", "304": "Georgia", "305": "Georgia",
    "306": "Georgia", "307": "Georgia", "308": "Georgia", "309": "Georgia",
    "310": "Georgia", "311": "Georgia", "312": "Georgia", "313": "Georgia",
    "314": "Georgia", "315": "Georgia", "316": "Georgia", "317": "Georgia",
    "318": "Georgia", "319": "Georgia", "320": "Florida", "321": "Florida",
    "322": "Florida", "323": "Florida", "324": "Florida", "325": "Florida",
    "326": "Florida", "327": "Florida", "328": "Florida", "329": "Florida",
    "330": "Florida", "331": "Florida", "332": "Florida", "333": "Florida",
    "334": "Florida", "335": "Florida", "336": "Florida", "337": "Florida",
    "338": "Florida", "339": "Florida", "340": "Florida", "341": "Florida",
    "342": "Florida", "344": "Florida", "346": "Florida", "347": "Florida",
    "349": "Florida", "350": "Alabama", "351": "Alabama", "352": "Alabama",
    "354": "Alabama", "355": "Alabama", "356": "Alabama", "357": "Alabama",
    "358": "Alabama", "359": "Alabama", "360": "Alabama", "361": "Alabama",
    "362": "Alabama", "363": "Alabama", "364": "Alabama", "365": "Alabama",
    "366": "Alabama", "367": "Alabama", "368": "Alabama", "369": "Alabama",
    "370": "Tennessee", "371": "Tennessee", "372": "Tennessee", "373": "Tennessee",
    "374": "Tennessee", "375": "Tennessee", "376": "Tennessee", "377": "Tennessee",
    "378": "Tennessee", "379": "Tennessee", "380": "Tennessee", "381": "Tennessee",
    "382": "Tennessee", "383": "Tennessee", "384": "Tennessee", "385": "Tennessee",
    "386": "Tennessee", "387": "Tennessee", "388": "Mississippi", "389": "Mississippi",
    "390": "Mississippi", "391": "Mississippi", "392": "Mississippi", "393": "Mississippi",
    "394": "Mississippi", "395": "Mississippi", "396": "Mississippi", "397": "Mississippi",
    "400": "Kentucky", "401": "Kentucky", "402": "Kentucky", "403": "Kentucky",
    "404": "Kentucky", "405": "Kentucky", "406": "Kentucky", "407": "Kentucky",
    "408": "Kentucky", "409": "Kentucky", "410": "Kentucky", "411": "Kentucky",
    "412": "Kentucky", "413": "Kentucky", "414": "Kentucky", "415": "Kentucky",
    "416": "Kentucky", "417": "Kentucky", "418": "Kentucky", "420": "Kentucky",
    "421": "Kentucky", "422": "Kentucky", "423": "Kentucky", "424": "Kentucky",
    "425": "Kentucky", "426": "Kentucky", "427": "Kentucky", "430": "Ohio",
    "431": "Ohio", "432": "Ohio", "433": "Ohio", "434": "Ohio", "435": "Ohio",
    "436": "Ohio", "437": "Ohio", "438": "Ohio", "439": "Ohio", "440": "Ohio",
    "441": "Ohio", "442": "Ohio", "443": "Ohio", "444": "Ohio", "445": "Ohio",
    "446": "Ohio", "447": "Ohio", "448": "Ohio", "449": "Ohio", "450": "Ohio",
    "451": "Ohio", "452": "Ohio", "453": "Ohio", "454": "Ohio", "455": "Ohio",
    "456": "Ohio", "457": "Ohio", "458": "Ohio", "460": "Indiana", "461": "Indiana",
    "462": "Indiana", "463": "Indiana", "464": "Indiana", "465": "Indiana",
    "466": "Indiana", "467": "Indiana", "468": "Indiana", "469": "Indiana",
    "470": "Indiana", "471": "Indiana", "472": "Indiana", "473": "Indiana",
    "474": "Indiana", "475": "Indiana", "476": "Indiana", "477": "Indiana",
    "478": "Indiana", "479": "Indiana", "480": "Michigan", "481": "Michigan",
    "482": "Michigan", "483": "Michigan", "484": "Michigan", "485": "Michigan",
    "486": "Michigan", "487": "Michigan", "488": "Michigan", "489": "Michigan",
    "490": "Michigan", "491": "Michigan", "492": "Michigan", "493": "Michigan",
    "494": "Michigan", "495": "Michigan", "496": "Michigan", "497": "Michigan",
    "498": "Michigan", "499": "Michigan", "500": "Iowa", "501": "Iowa",
    "502": "Iowa", "503": "Iowa", "504": "Iowa", "505": "Iowa", "506": "Iowa",
    "507": "Iowa", "508": "Iowa", "509": "Iowa", "510": "Iowa", "511": "Iowa",
    "512": "Iowa", "513": "Iowa", "514": "Iowa", "515": "Iowa", "516": "Iowa",
    "520": "Iowa", "521": "Iowa", "522": "Iowa", "523": "Iowa", "524": "Iowa",
    "525": "Iowa", "526": "Iowa", "527": "Iowa", "528": "Iowa", "530": "Wisconsin",
    "531": "Wisconsin", "532": "Wisconsin", "534": "Wisconsin", "535": "Wisconsin",
    "537": "Wisconsin", "538": "Wisconsin", "539": "Wisconsin", "540": "Wisconsin",
    "541": "Wisconsin", "542": "Wisconsin", "543": "Wisconsin", "544": "Wisconsin",
    "545": "Wisconsin", "546": "Wisconsin", "547": "Wisconsin", "548": "Wisconsin",
    "549": "Wisconsin", "550": "Minnesota", "551": "Minnesota", "553": "Minnesota",
    "554": "Minnesota", "555": "Minnesota", "556": "Minnesota", "557": "Minnesota",
    "558": "Minnesota", "559": "Minnesota", "560": "Minnesota", "561": "Minnesota",
    "562": "Minnesota", "563": "Minnesota", "564": "Minnesota", "565": "Minnesota",
    "566": "Minnesota", "567": "Minnesota", "570": "South Dakota", "571": "South Dakota",
    "572": "South Dakota", "573": "South Dakota", "574": "South Dakota", "575": "South Dakota",
    "576": "South Dakota", "577": "South Dakota", "580": "North Dakota", "581": "North Dakota",
    "582": "North Dakota", "583": "North Dakota", "584": "North Dakota", "585": "North Dakota",
    "586": "North Dakota", "587": "North Dakota", "588": "North Dakota", "590": "Montana",
    "591": "Montana", "592": "Montana", "593": "Montana", "594": "Montana",
    "595": "Montana", "596": "Montana", "597": "Montana", "598": "Montana",
    "599": "Montana", "600": "Illinois", "601": "Illinois", "602": "Illinois",
    "603": "Illinois", "604": "Illinois", "605": "Illinois", "606": "Illinois",
    "607": "Illinois", "608": "Illinois", "609": "Illinois", "610": "Illinois",
    "611": "Illinois", "612": "Illinois", "613": "Illinois", "614": "Illinois",
    "615": "Illinois", "616": "Illinois", "617": "Illinois", "618": "Illinois",
    "619": "Illinois", "620": "Illinois", "622": "Illinois", "623": "Illinois",
    "624": "Illinois", "625": "Illinois", "626": "Illinois", "627": "Illinois",
    "628": "Illinois", "629": "Illinois", "630": "Missouri", "631": "Missouri",
    "633": "Missouri", "634": "Missouri", "635": "Missouri", "636": "Missouri",
    "637": "Missouri", "638": "Missouri", "639": "Missouri", "640": "Missouri",
    "641": "Missouri", "644": "Missouri", "645": "Missouri", "646": "Missouri",
    "647": "Missouri", "648": "Missouri", "650": "Missouri", "651": "Missouri",
    "652": "Missouri", "653": "Missouri", "654": "Missouri", "655": "Missouri",
    "656": "Missouri", "657": "Missouri", "658": "Missouri", "660": "Kansas",
    "661": "Kansas", "662": "Kansas", "664": "Kansas", "665": "Kansas",
    "666": "Kansas", "667": "Kansas", "668": "Kansas", "669": "Kansas",
    "670": "Kansas", "671": "Kansas", "672": "Kansas", "673": "Kansas",
    "674": "Kansas", "675": "Kansas", "676": "Kansas", "677": "Kansas",
    "678": "Kansas", "679": "Kansas", "680": "Nebraska", "681": "Nebraska",
    "683": "Nebraska", "684": "Nebraska", "685": "Nebraska", "686": "Nebraska",
    "687": "Nebraska", "688": "Nebraska", "689": "Nebraska", "690": "Nebraska",
    "691": "Nebraska", "692": "Nebraska", "693": "Nebraska", "700": "Louisiana",
    "701": "Louisiana", "703": "Louisiana", "704": "Louisiana", "705": "Louisiana",
    "706": "Louisiana", "707": "Louisiana", "708": "Louisiana", "710": "Louisiana",
    "711": "Louisiana", "712": "Louisiana", "713": "Louisiana", "714": "Louisiana",
    "716": "Arkansas", "717": "Arkansas", "718": "Arkansas", "719": "Arkansas",
    "720": "Arkansas", "721": "Arkansas", "722": "Arkansas", "723": "Arkansas",
    "724": "Arkansas", "725": "Arkansas", "726": "Arkansas", "727": "Arkansas",
    "728": "Arkansas", "729": "Arkansas", "730": "Oklahoma", "731": "Oklahoma",
    "734": "Oklahoma", "735": "Oklahoma", "736": "Oklahoma", "737": "Oklahoma",
    "738": "Oklahoma", "739": "Oklahoma", "740": "Oklahoma", "741": "Oklahoma",
    "743": "Oklahoma", "744": "Oklahoma", "745": "Oklahoma", "746": "Oklahoma",
    "747": "Oklahoma", "748": "Oklahoma", "749": "Oklahoma", "750": "Texas",
    "751": "Texas", "752": "Texas", "753": "Texas", "754": "Texas", "755": "Texas",
    "756": "Texas", "757": "Texas", "758": "Texas", "759": "Texas", "760": "Texas",
    "761": "Texas", "762": "Texas", "763": "Texas", "764": "Texas", "765": "Texas",
    "766": "Texas", "767": "Texas", "768": "Texas", "769": "Texas", "770": "Texas",
    "772": "Texas", "773": "Texas", "774": "Texas", "775": "Texas", "776": "Texas",
    "777": "Texas", "778": "Texas", "779": "Texas", "780": "Texas", "781": "Texas",
    "782": "Texas", "783": "Texas", "784": "Texas", "785": "Texas", "786": "Texas",
    "787": "Texas", "788": "Texas", "789": "Texas", "790": "Texas", "791": "Texas",
    "792": "Texas", "793": "Texas", "794": "Texas", "795": "Texas", "796": "Texas",
    "797": "Texas", "798": "Texas", "799": "Texas", "800": "Colorado", "801": "Colorado",
    "802": "Colorado", "803": "Colorado", "804": "Colorado", "805": "Colorado",
    "806": "Colorado", "807": "Colorado", "808": "Colorado", "809": "Colorado",
    "810": "Colorado", "811": "Colorado", "812": "Colorado", "813": "Colorado",
    "814": "Colorado", "815": "Colorado", "816": "Colorado", "820": "Wyoming",
    "821": "Wyoming", "822": "Wyoming", "823": "Wyoming", "824": "Wyoming",
    "825": "Wyoming", "826": "Wyoming", "827": "Wyoming", "828": "Wyoming",
    "829": "Wyoming", "830": "Wyoming", "831": "Wyoming", "840": "Utah",
    "841": "Utah", "842": "Utah", "843": "Utah", "844": "Utah", "845": "Utah",
    "846": "Utah", "847": "Utah", "850": "Arizona", "852": "Arizona",
    "853": "Arizona", "855": "Arizona", "856": "Arizona", "857": "Arizona",
    "859": "Arizona", "860": "Arizona", "863": "Arizona", "864": "Arizona",
    "865": "Arizona", "870": "New Mexico", "871": "New Mexico", "872": "New Mexico",
    "873": "New Mexico", "874": "New Mexico", "875": "New Mexico", "877": "New Mexico",
    "878": "New Mexico", "879": "New Mexico", "880": "New Mexico", "881": "New Mexico",
    "882": "New Mexico", "883": "New Mexico", "884": "New Mexico", "890": "Nevada",
    "891": "Nevada", "893": "Nevada", "894": "Nevada", "895": "Nevada",
    "897": "Nevada", "898": "Nevada", "900": "California", "901": "California",
    "902": "California", "903": "California", "904": "California", "905": "California",
    "906": "California", "907": "California", "908": "California", "910": "California",
    "911": "California", "912": "California", "913": "California", "914": "California",
    "915": "California", "916": "California", "917": "California", "918": "California",
    "919": "California", "920": "California", "921": "California", "922": "California",
    "923": "California", "924": "California", "925": "California", "926": "California",
    "927": "California", "928": "California", "930": "California", "931": "California",
    "932": "California", "933": "California", "934": "California", "935": "California",
    "936": "California", "937": "California", "938": "California", "939": "California",
    "940": "California", "941": "California", "942": "California", "943": "California",
    "944": "California", "945": "California", "946": "California", "947": "California",
    "948": "California", "949": "California", "950": "California", "951": "California",
    "952": "California", "953": "California", "954": "California", "955": "California",
    "956": "California", "957": "California", "958": "California", "959": "California",
    "960": "California", "961": "California", "967": "Hawaii", "968": "Hawaii",
    "970": "Oregon", "971": "Oregon", "972": "Oregon", "973": "Oregon",
    "974": "Oregon", "975": "Oregon", "976": "Oregon", "977": "Oregon",
    "978": "Oregon", "979": "Oregon", "980": "Washington", "981": "Washington",
    "982": "Washington", "983": "Washington", "984": "Washington", "985": "Washington",
    "986": "Washington", "988": "Washington", "989": "Washington", "990": "Washington",
    "991": "Washington", "992": "Washington", "993": "Washington", "994": "Washington",
    "995": "Alaska", "996": "Alaska", "997": "Alaska", "998": "Alaska", "999": "Alaska",
  };

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Get state name from ZIP code
   */
  private getStateFromZip(zipcode: string): string {
    const zip = zipcode.replace(/\D/g, "");
    if (zip.length < 3) return "";
    const firstThree = zip.substring(0, 3);
    return ZabasearchScraper.zipToState[firstThree] || "";
  }

  /**
   * Fetch URL using CORS proxy rotation
   */
  private async fetchWithProxy(targetUrl: string): Promise<string | null> {
    console.log(`🔍 Zabasearch - Fetching URL: ${targetUrl}`);

    // Try direct fetch first (works from Deno Edge Functions)
    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });

      if (response.ok) {
        const html = await response.text();
        if (html.length > 1000 && !html.includes("Just a moment...")) {
          console.log(`✅ Zabasearch - Direct fetch success, HTML length: ${html.length}`);
          return html;
        }
      }
    } catch (error) {
      console.log(`⚠️ Zabasearch - Direct fetch failed: ${(error as Error).message}`);
    }

    // Fallback to CORS proxies
    for (let i = 0; i < this.corsProxies.length; i++) {
      const proxy = this.corsProxies[i];
      const proxyUrl = `${proxy}${encodeURIComponent(targetUrl)}`;

      console.log(`🔍 Zabasearch - Trying proxy ${i + 1}/${this.corsProxies.length}`);

      try {
        const response = await fetch(proxyUrl, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        });

        if (!response.ok) {
          console.log(`🔍 Zabasearch - Proxy ${i + 1} failed with status: ${response.status}`);
          continue;
        }

        const html = await response.text();

        if (html.includes("Just a moment...") || html.includes("Checking your browser") || html.includes("Access denied")) {
          console.log(`🔍 Zabasearch - Proxy ${i + 1} got blocked page`);
          continue;
        }

        if (html.length < 1000) {
          console.log(`🔍 Zabasearch - Proxy ${i + 1} returned too little content`);
          continue;
        }

        console.log(`✅ Zabasearch - Proxy ${i + 1} success! HTML length: ${html.length}`);
        return html;
      } catch (error) {
        console.error(`🔍 Zabasearch - Proxy ${i + 1} error:`, error);
        continue;
      }
    }

    console.log(`❌ Zabasearch - All fetch methods failed`);
    return null;
  }

  /**
   * Filter profiles by ZIP code match
   */
  private filterByZipCode(profiles: PersonProfile[], zipcode?: string): PersonProfile[] {
    if (!zipcode) return profiles;

    const cleanedZip = zipcode.replace(/\D/g, "").substring(0, 5);
    console.log(`🔍 Zabasearch - Filtering ${profiles.length} profiles for ZIP: ${cleanedZip}`);

    const filtered = profiles.filter(profile => {
      const addresses = profile.addresses || [];
      const pastAddresses = profile.past_addresses || [];
      const allAddresses = [...addresses.map(a => a.full_address || a.address || ""), ...pastAddresses];

      return allAddresses.some(addr => {
        const zipMatch = addr?.match(/\b\d{5}\b/);
        return zipMatch && zipMatch[0] === cleanedZip;
      });
    });

    console.log(`🔍 Zabasearch - Filtered to ${filtered.length} profiles`);
    return filtered;
  }

  // --------------------------------------------------------------------------
  // Public Scraping Methods
  // --------------------------------------------------------------------------

  /**
   * Search by name (legacy interface)
   */
  async scrape(
    firstName: string,
    lastName: string,
    city?: string,
    state?: string
  ): Promise<PersonProfile[]> {
    const formattedName = `${this.formatNameForUrl(firstName)}-${this.formatNameForUrl(lastName)}`;
    let url = `https://www.zabasearch.com/people/${formattedName}`;

    // Add state to URL if provided
    if (state) {
      const stateName = this.getStateName(state).toLowerCase().replace(/\s+/g, "-");
      url += `/${stateName}`;
    }

    // Add city to URL if provided (after state)
    if (city) {
      const formattedCity = this.formatNameForUrl(city);
      url += `/${formattedCity}`;
    }

    console.log(`🔍 Zabasearch - Searching: ${url}`);

    const html = await this.fetchWithProxy(url);
    if (!html) return [];

    const doc = this.parseHtml(html);
    if (!doc) return [];

    const profiles: PersonProfile[] = [];

    // Find profile cards (div.person elements)
    const personDivs = doc.querySelectorAll("div.person");
    console.log(`🔍 Zabasearch - Found ${personDivs.length} person divs`);

    personDivs.forEach((personDiv: any, index: number) => {
      try {
        const id = personDiv.getAttribute("data-id") || `zaba-${index}`;
        const nameElement = personDiv.querySelector("h2 a");
        const ageElement = personDiv.querySelector("h3");

        // Extract name and age
        const name = nameElement?.textContent?.trim() || `${firstName} ${lastName}`;
        const age = ageElement?.textContent?.trim();

        // Extract aliases from #container-alt-names
        const aliases: Array<{ alias: string }> = [];
        const altNamesContainer = personDiv.querySelector("#container-alt-names");
        if (altNamesContainer) {
          const aliasLis = altNamesContainer.querySelectorAll("ul li");
          aliasLis.forEach((li: any) => {
            const aliasText = li.textContent?.trim() || "";
            if (aliasText && aliasText.length > 2) {
              aliases.push({ alias: aliasText });
            }
          });
        }

        // Extract relatives from "Possible Relatives" section
        const relatives: Array<{ name: string; relationship?: string }> = [];
        const relativeSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
          h3.textContent?.trim() === "Possible Relatives"
        );
        if (relativeSection) {
          const relativeList = relativeSection.parentElement?.querySelector("ul");
          if (relativeList) {
            const relativeLinks = relativeList.querySelectorAll("li a");
            relativeLinks.forEach((link: any) => {
              const relName = link.textContent?.trim() || "";
              if (relName && relName.length > 2) {
                relatives.push({ name: relName, relationship: "family" });
              }
            });
          }
        }

        // Extract phone numbers from "Associated Phone Numbers" section
        const phones: Array<{ number: string; type?: string; primary?: boolean }> = [];
        const seenPhones = new Set<string>();
        let phoneSnippet = "";
        const phoneSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
          h3.textContent?.trim() === "Associated Phone Numbers"
        );
        if (phoneSection) {
          const phoneList = phoneSection.parentElement?.querySelector("ul");
          if (phoneList) {
            const phoneLinks = phoneList.querySelectorAll("li a");
            phoneLinks.forEach((link: any, pIdx: number) => {
              const phoneText = link.textContent?.trim() || "";
              if (phoneText && !seenPhones.has(phoneText)) {
                seenPhones.add(phoneText);
                phones.push({ number: phoneText, type: "unknown", primary: pIdx === 0 });
                if (pIdx === 0) phoneSnippet = this.maskPhone(phoneText);
              }
            });
          }
        }

        // Extract address from "Last Known Address" section
        const addresses: Array<{ full_address?: string; city?: string; state?: string; zip?: string; is_last_known?: boolean }> = [];
        const addressSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
          h3.textContent?.trim() === "Last Known Address"
        );
        let cityState = "";
        if (addressSection) {
          const addressDiv = addressSection.parentElement?.querySelector("div.flex div p");
          if (addressDiv) {
            const addressText = addressDiv.textContent?.trim() || "";
            if (addressText) {
              // Parse address like "7935 Holmes RD\n Kansas City, Missouri 64131"
              const lines = addressText.split("\n").map(l => l.trim()).filter(l => l);
              const street = lines[0] || "";
              const cityStateZip = lines[1] || "";
              
              // Extract city, state, zip from "Kansas City, Missouri 64131"
              const cityStateMatch = cityStateZip.match(/^(.+?),\s*([A-Za-z\s]+?)\s+(\d{5})/);
              if (cityStateMatch) {
                const city = cityStateMatch[1].trim();
                const state = cityStateMatch[2].trim();
                const zip = cityStateMatch[3];
                cityState = `${street}, ${city}, ${state}`;
                addresses.push({
                  full_address: addressText.replace(/\n/g, ", "),
                  street: street,
                  city: city,
                  state: state,
                  zip: zip,
                  is_last_known: true
                });
              } else {
                cityState = addressText.replace(/\n/g, ", ");
                addresses.push({
                  full_address: cityState,
                  is_last_known: true
                });
              }
            }
          }
        }

        // Extract past addresses from "Past Addresses" section
        const pastAddressSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
          h3.textContent?.trim() === "Past Addresses"
        );
        if (pastAddressSection) {
          const pastAddressList = pastAddressSection.parentElement?.querySelector("ul");
          if (pastAddressList) {
            const pastAddressItems = pastAddressList.querySelectorAll("li");
            pastAddressItems.forEach((li: any) => {
              const addressText = li.textContent?.trim() || "";
              if (addressText && addressText.length > 10) {
                // Parse address like "400 E 20th ST Apt 2117\n Kansas City, Missouri 64108"
                const lines = addressText.split("\n").map(l => l.trim()).filter(l => l);
                const street = lines[0] || "";
                const cityStateZip = lines[1] || "";
                
                const cityStateMatch = cityStateZip.match(/^(.+?),\s*([A-Za-z\s]+?)\s+(\d{5})/);
                if (cityStateMatch) {
                  const city = cityStateMatch[1].trim();
                  const state = cityStateMatch[2].trim();
                  const zip = cityStateMatch[3];
                  addresses.push({
                    full_address: addressText.replace(/\n/g, ", "),
                    street: street,
                    city: city,
                    state: state,
                    zip: zip,
                    is_last_known: false
                  });
                } else {
                  addresses.push({
                    full_address: addressText.replace(/\n/g, ", "),
                    is_last_known: false
                  });
                }
              }
            });
          }
        }

        // Extract emails from "Associated Email Addresses" section
        const emails: Array<{ email: string; type?: string }> = [];
        const emailSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
          h3.textContent?.trim() === "Associated Email Addresses"
        );
        if (emailSection) {
          const emailList = emailSection.parentElement?.querySelector("ul.showMore-list");
          if (emailList) {
            const emailItems = emailList.querySelectorAll("li");
            emailItems.forEach((li: any) => {
              // Handle blurred emails like "<span class="blur">clark.l</span>@ehawksolutions.com"
              const emailText = li.textContent?.trim() || "";
              // Extract email pattern (may have blurred parts)
              const emailMatch = emailText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
              if (emailMatch) {
                const email = emailMatch[1].toLowerCase();
                if (!email.includes("zabasearch") && !email.includes("intelius")) {
                  emails.push({ email, type: "unknown" });
                }
              }
            });
          }
        }

        // Extract jobs from "Jobs" section
        const jobs: Array<{ company?: string; title?: string; location?: string; current?: boolean; duration?: string; since?: string }> = [];
        const jobsSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
          h3.textContent?.trim() === "Jobs"
        );
        if (jobsSection) {
          const jobsList = jobsSection.parentElement?.querySelector("ul.showMore-list");
          if (jobsList) {
            const jobItems = jobsList.querySelectorAll("li");
            jobItems.forEach((li: any) => {
              const jobText = li.textContent?.trim() || "";
              // Parse formats like:
              // "Civicplus Sales Representative at Civicplus (Since 2018)"
              // "Civicplus Consultant/Trainer at Civicplus (Since 2016)"
              // "Netsmart Technologies Plexus Delivery Consultant at Netsmart Technologies (2015-2016)"
              const jobMatch = jobText.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s*\((.+?)\))?$/);
              if (jobMatch) {
                const titleCompany = jobMatch[1].trim();
                const company = jobMatch[2].trim();
                const dateRange = jobMatch[3]?.trim() || "";
                
                // Extract title (everything before company name)
                const titleMatch = titleCompany.match(/^(.+?)\s+(.+)$/);
                const title = titleMatch ? titleMatch[2] : titleCompany;
                
                // Parse date range
                let isCurrent = false;
                let since: string | undefined;
                let duration: string | undefined;
                
                if (dateRange.toLowerCase().includes("since")) {
                  isCurrent = true;
                  const sinceMatch = dateRange.match(/since\s+(\d{4})/i);
                  if (sinceMatch) since = sinceMatch[1];
                } else if (dateRange.includes("-")) {
                  duration = dateRange;
                  const yearMatch = dateRange.match(/(\d{4})-(\d{4})/);
                  if (yearMatch) {
                    const endYear = parseInt(yearMatch[2]);
                    const currentYear = new Date().getFullYear();
                    isCurrent = endYear >= currentYear - 1; // Consider current if ended within last year
                  }
                }
                
                jobs.push({
                  company,
                  title,
                  is_current: isCurrent,
                  since,
                  duration
                });
              } else if (jobText.length > 3) {
                // Fallback: just company name
                jobs.push({ company: jobText });
              }
            });
          }
        }

        // Extract education from "Education" section
        const education: Array<{ school?: string; degree?: string; dates?: string }> = [];
        const educationSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
          h3.textContent?.trim() === "Education"
        );
        if (educationSection) {
          const educationList = educationSection.parentElement?.querySelector("ul.showMore-list");
          if (educationList) {
            const educationItems = educationList.querySelectorAll("li");
            educationItems.forEach((li: any) => {
              const eduText = li.textContent?.trim() || "";
              // Parse format like "Bachelor of Science, Organizational Communication from Northwest Missouri State University (2010-2014)"
              const eduMatch = eduText.match(/^(.+?)\s+from\s+(.+?)(?:\s*\((.+?)\))?$/);
              if (eduMatch) {
                const degreeField = eduMatch[1].trim();
                const school = eduMatch[2].trim();
                const dates = eduMatch[3]?.trim();
                
                // Split degree and field if comma-separated
                const degreeParts = degreeField.split(",").map(p => p.trim());
                const degree = degreeParts[0] || degreeField;
                const fieldOfStudy = degreeParts[1];
                
                education.push({
                  school,
                  degree: fieldOfStudy ? `${degree}, ${fieldOfStudy}` : degree,
                  dates
                });
              } else if (eduText.length > 3) {
                // Fallback: just school name
                education.push({ school: eduText });
              }
            });
          }
        }

        // Extract detail link - use the name link or find any /people/ link
        let detailLink: string | undefined;
        if (nameElement) {
          const href = nameElement.getAttribute("href");
          if (href) {
            detailLink = href.startsWith("http") ? href : `https://www.zabasearch.com${href}`;
          }
        }
        
        // Fallback: find any /people/ link
        if (!detailLink) {
          const links = personDiv.querySelectorAll("a");
          for (const link of links) {
            const href = link.getAttribute("href");
            if (href && href.includes("/people/") && !href.includes("/phone/")) {
              detailLink = href.startsWith("http") ? href : `https://www.zabasearch.com${href}`;
              break;
            }
          }
        }

        profiles.push({
          id,
          name,
          age: age,
          phone_snippet: phoneSnippet,
          city_state: cityState,
          current_address: cityState, // For modal display
          phones: phones.length > 0 ? phones : undefined,
          addresses: addresses.length > 0 ? addresses : undefined,
          relatives: relatives.length > 0 ? relatives : undefined,
          aliases: aliases.length > 0 ? aliases : undefined,
          emails: emails.length > 0 ? emails : undefined,
          jobs: jobs.length > 0 ? jobs : undefined,
          education: education.length > 0 ? education : undefined,
          detail_link: detailLink,
          source: "Zabasearch",
        });
      } catch (err) {
        console.error(`Error parsing Zabasearch person div ${index}:`, err);
      }
    });

    return profiles;
  }

  /**
   * Search by name with flexible input (NEW interface)
   */
  override async searchProfiles(input: SearchInput): Promise<ProfileMatch[]> {
    // If phone search is requested, use phone search
    if (input.phone && this.supportedSearchTypes.includes("phone")) {
      return this.searchByPhone(input.phone);
    }

    // Default to name search
    const profiles = await this.scrape(
      input.first_name || "",
      input.last_name || "",
      input.city,
      input.state
    );

    // Filter by ZIP if provided
    const filtered = this.filterByZipCode(profiles, input.zip);

    // Convert to ProfileMatch format, preserving full profile data for ZabaSearch
    return filtered.map(p => ({
      id: p.id,
      name: p.name,
      age: p.age,
      city_state: p.city_state,
      phone_snippet: p.phone_snippet,
      detail_link: p.detail_link,
      source: this.name,
      // Include full profile data since ZabaSearch already has it in search results
      fullProfile: p,
    }));
  }

  /**
   * Search by phone number
   */
  async searchByPhone(phone: string): Promise<ProfileMatch[]> {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      console.log(`❌ Zabasearch - Invalid phone number: ${phone}`);
      return [];
    }

    // Format: XXX-XXX-XXXX
    const formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    const url = `https://www.zabasearch.com/phone/${formatted}`;

    console.log(`🔍 Zabasearch - Phone search: ${url}`);

    const html = await this.fetchWithProxy(url);
    if (!html) return [];

    const doc = this.parseHtml(html);
    if (!doc) return [];

    const profiles: ProfileMatch[] = [];

    // Parse phone search results (similar structure to name search)
    const personDivs = doc.querySelectorAll("div.person");
    console.log(`🔍 Zabasearch - Phone search found ${personDivs.length} results`);

    personDivs.forEach((personDiv: any, index: number) => {
      try {
        const id = personDiv.getAttribute("data-id") || `zaba-phone-${index}`;
        const nameElement = personDiv.querySelector("h2 a");
        const ageElement = personDiv.querySelector("h3");
        const locationElement = personDiv.querySelector("[data-location]") ||
                                personDiv.querySelector(".location");

        let detailLink: string | undefined;
        const links = personDiv.querySelectorAll("a");
        for (const link of links) {
          const href = link.getAttribute("href");
          if (href && href.includes("/people/")) {
            detailLink = href.startsWith("http") ? href : `https://www.zabasearch.com${href}`;
            break;
          }
        }

        profiles.push({
          id,
          name: nameElement?.textContent?.trim() || "Unknown",
          age: ageElement?.textContent?.trim(),
          city_state: locationElement?.textContent?.trim(),
          phone_snippet: this.maskPhone(phone),
          detail_link: detailLink,
          source: this.name,
        });
      } catch (err) {
        console.error(`Error parsing phone result ${index}:`, err);
      }
    });

    return profiles;
  }

  /**
   * Scrape full profile details (legacy interface)
   */
  async scrapeDetails(url: string): Promise<PersonProfile | null> {
    console.log(`🔍 Zabasearch - Scraping details from: ${url}`);

    const html = await this.fetchWithProxy(url);
    if (!html) return null;

    const doc = this.parseHtml(html);
    if (!doc) return null;

    const bodyText = doc.body?.textContent || doc.documentElement?.textContent || "";

    const profile: PersonProfile = {
      id: "details",
      name: "",
      source: "Zabasearch",
      phones: [],
      emails: [],
      addresses: [],
      relatives: [],
      aliases: [],
      jobs: [],
      education: [],
      past_addresses: [],
    };

    // Extract name
    const nameElement = doc.querySelector("h1") || doc.querySelector("h2 a");
    if (nameElement) {
      const nameText = nameElement.textContent?.trim() || "";
      // Handle "Name, Age" format
      const nameMatch = nameText.match(/^(.+?),\s*(\d+)$/);
      if (nameMatch) {
        profile.name = nameMatch[1].trim();
        profile.age = nameMatch[2];
      } else {
        profile.name = nameText;
      }
    }

    // Extract age if not already found
    if (!profile.age) {
      const ageMatch = bodyText.match(/Age\s+(\d+)/i);
      if (ageMatch) profile.age = ageMatch[1];
    }

    console.log(`🔍 Zabasearch - Profile name: ${profile.name}, age: ${profile.age}`);

    // Extract phone numbers from tel: links
    const seenPhones = new Set<string>();
    const telLinks = doc.querySelectorAll("a[href^='tel:']");
    telLinks.forEach((link: any, index: number) => {
      const phoneText = link.textContent?.trim() || "";
      const cleaned = phoneText.replace(/\D/g, "");
      if (cleaned.length >= 10 && !seenPhones.has(cleaned)) {
        seenPhones.add(cleaned);
        profile.phones?.push({
          number: this.formatPhone(phoneText),
          type: "unknown",
          primary: index === 0,
        });
      }
    });

    // Fallback: extract phones from text
    if (profile.phones?.length === 0) {
      const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const matches = bodyText.matchAll(phonePattern);
      for (const match of matches) {
        const cleaned = match[0].replace(/\D/g, "");
        if (cleaned.length === 10 && !seenPhones.has(cleaned)) {
          seenPhones.add(cleaned);
          profile.phones?.push({
            number: this.formatPhone(match[0]),
            type: "unknown",
            primary: profile.phones.length === 0,
          });
        }
      }
    }

    console.log(`📞 Zabasearch - Found ${profile.phones?.length || 0} phones`);

    // Extract emails
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const emailMatches = bodyText.matchAll(emailPattern);
    const seenEmails = new Set<string>();
    for (const match of emailMatches) {
      const email = match[1].toLowerCase();
      if (!seenEmails.has(email) && !email.includes("zabasearch")) {
        seenEmails.add(email);
        profile.emails?.push({ email });
      }
    }

    console.log(`📧 Zabasearch - Found ${profile.emails?.length || 0} emails`);

    // Extract addresses
    const addressSection = doc.querySelector("#addresses") || doc.querySelector(".addresses");
    if (addressSection) {
      const addressDivs = addressSection.querySelectorAll("div, li");
      addressDivs.forEach((div: any, index: number) => {
        const addrText = div.textContent?.trim() || "";
        if (addrText.length > 10 && /\d/.test(addrText)) {
          // Parse address components
          const stateMatch = addrText.match(/\s([A-Z]{2})\s+\d{5}/);
          const zipMatch = addrText.match(/\b(\d{5})(?:-\d{4})?\b/);
          const cityMatch = addrText.match(/,\s*([A-Za-z\s]+),\s*[A-Z]{2}/);

          profile.addresses?.push({
            full_address: addrText,
            state: stateMatch ? stateMatch[1] : undefined,
            zip: zipMatch ? zipMatch[1] : undefined,
            city: cityMatch ? cityMatch[1].trim() : undefined,
            is_last_known: index === 0,
          });

          if (index === 0) {
            profile.current_address = addrText;
          } else {
            profile.past_addresses?.push(addrText);
          }
        }
      });
    }

    console.log(`🏠 Zabasearch - Found ${profile.addresses?.length || 0} addresses`);

    // Extract aliases (AKA)
    const akaMatch = bodyText.match(/(?:AKA|Also Known As)[:\s]+([^]+?)(?:Lives|Address|Phone|Relatives|$)/i);
    if (akaMatch) {
      const aliasList = akaMatch[1].split(/[,•\n]/).map((a: string) => a.trim()).filter((a: string) => a.length > 2 && a.length < 50);
      aliasList.forEach((alias: string) => {
        if (!alias.toLowerCase().includes("aka") && !alias.toLowerCase().includes("lives")) {
          profile.aliases?.push({ alias });
        }
      });
    }

    console.log(`👤 Zabasearch - Found ${profile.aliases?.length || 0} aliases`);

    // Extract relatives
    const relativesSection = doc.querySelector("#relatives") || doc.querySelector(".relatives");
    if (relativesSection) {
      const relLinks = relativesSection.querySelectorAll("a");
      const seenRelatives = new Set<string>();

      relLinks.forEach((link: any) => {
        const relName = link.textContent?.trim() || "";
        const nameLower = relName.toLowerCase();

        if (relName.length > 2 &&
            relName.length < 50 &&
            !seenRelatives.has(nameLower) &&
            relName.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+/)) {
          seenRelatives.add(nameLower);

          // Try to extract age from nearby text
          const parent = link.parentElement;
          const parentText = parent?.textContent || "";
          const ageMatch = parentText.match(/Age\s*(\d+)/i);

          profile.relatives?.push({
            name: relName,
            relationship: "family",
            age: ageMatch ? ageMatch[1] : undefined,
          });
        }
      });
    }

    console.log(`👨‍👩‍👧 Zabasearch - Found ${profile.relatives?.length || 0} relatives`);

    // Set convenience fields
    if (profile.phones && profile.phones.length > 0) {
      profile.current_phone = profile.phones[0].number;
      profile.additional_numbers = profile.phones.slice(1).map(p => p.number);
    }

    console.log(`✅ Zabasearch - Scraped profile:`, {
      name: profile.name,
      phones: profile.phones?.length || 0,
      emails: profile.emails?.length || 0,
      addresses: profile.addresses?.length || 0,
      relatives: profile.relatives?.length || 0,
      aliases: profile.aliases?.length || 0,
    });

    return profile;
  }

  /**
   * Scrape full profile in JSONB format (NEW interface)
   */
  /**
   * Extract full profile data from a person div (used for search results pages)
   */
  private async extractFullProfileFromDiv(
    personDiv: any,
    name: string,
    age: string | undefined,
    id: string
  ): Promise<PersonProfile> {
    // This reuses the extraction logic from scrape() method
    // Extract all the same fields we extract in scrape()
    
    const profile: PersonProfile = {
      id,
      name,
      age,
      source: "Zabasearch",
      phones: [],
      emails: [],
      addresses: [],
      relatives: [],
      aliases: [],
      jobs: [],
      education: [],
    };

    // Extract aliases
    const altNamesContainer = personDiv.querySelector("#container-alt-names");
    if (altNamesContainer) {
      const aliasLis = altNamesContainer.querySelectorAll("ul li");
      aliasLis.forEach((li: any) => {
        const aliasText = li.textContent?.trim() || "";
        if (aliasText && aliasText.length > 2) {
          profile.aliases?.push({ alias: aliasText });
        }
      });
    }

    // Extract relatives
    const relativeSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
      h3.textContent?.trim() === "Possible Relatives"
    );
    if (relativeSection) {
      const relativeList = relativeSection.parentElement?.querySelector("ul");
      if (relativeList) {
        const relativeLinks = relativeList.querySelectorAll("li a");
        relativeLinks.forEach((link: any) => {
          const relName = link.textContent?.trim() || "";
          if (relName && relName.length > 2) {
            profile.relatives?.push({ name: relName, relationship: "family" });
          }
        });
      }
    }

    // Extract phones
    const seenPhones = new Set<string>();
    const phoneSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
      h3.textContent?.trim() === "Associated Phone Numbers"
    );
    if (phoneSection) {
      const phoneList = phoneSection.parentElement?.querySelector("ul");
      if (phoneList) {
        const phoneLinks = phoneList.querySelectorAll("li a");
        phoneLinks.forEach((link: any, pIdx: number) => {
          const phoneText = link.textContent?.trim() || "";
          if (phoneText && !seenPhones.has(phoneText)) {
            seenPhones.add(phoneText);
            profile.phones?.push({ number: phoneText, type: "unknown", primary: pIdx === 0 });
          }
        });
      }
    }

    // Extract addresses (last known + past)
    const addressSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
      h3.textContent?.trim() === "Last Known Address"
    );
    if (addressSection) {
      const addressDiv = addressSection.parentElement?.querySelector("div.flex div p");
      if (addressDiv) {
        const addressText = addressDiv.textContent?.trim() || "";
        if (addressText) {
          const lines = addressText.split("\n").map(l => l.trim()).filter(l => l);
          const street = lines[0] || "";
          const cityStateZip = lines[1] || "";
          const cityStateMatch = cityStateZip.match(/^(.+?),\s*([A-Za-z\s]+?)\s+(\d{5})/);
          if (cityStateMatch) {
            profile.addresses?.push({
              full_address: addressText.replace(/\n/g, ", "),
              street: street,
              city: cityStateMatch[1].trim(),
              state: cityStateMatch[2].trim(),
              zip: cityStateMatch[3],
              is_last_known: true
            });
          } else {
            profile.addresses?.push({
              full_address: addressText.replace(/\n/g, ", "),
              is_last_known: true
            });
          }
        }
      }
    }

    // Extract past addresses
    const pastAddressSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
      h3.textContent?.trim() === "Past Addresses"
    );
    if (pastAddressSection) {
      const pastAddressList = pastAddressSection.parentElement?.querySelector("ul");
      if (pastAddressList) {
        const pastAddressItems = pastAddressList.querySelectorAll("li");
        pastAddressItems.forEach((li: any) => {
          const addressText = li.textContent?.trim() || "";
          if (addressText && addressText.length > 10) {
            const lines = addressText.split("\n").map(l => l.trim()).filter(l => l);
            const street = lines[0] || "";
            const cityStateZip = lines[1] || "";
            const cityStateMatch = cityStateZip.match(/^(.+?),\s*([A-Za-z\s]+?)\s+(\d{5})/);
            if (cityStateMatch) {
              profile.addresses?.push({
                full_address: addressText.replace(/\n/g, ", "),
                street: street,
                city: cityStateMatch[1].trim(),
                state: cityStateMatch[2].trim(),
                zip: cityStateMatch[3],
                is_last_known: false
              });
            } else {
              profile.addresses?.push({
                full_address: addressText.replace(/\n/g, ", "),
                is_last_known: false
              });
            }
          }
        });
      }
    }

    // Extract emails
    const emailSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
      h3.textContent?.trim() === "Associated Email Addresses"
    );
    if (emailSection) {
      const emailList = emailSection.parentElement?.querySelector("ul.showMore-list");
      if (emailList) {
        const emailItems = emailList.querySelectorAll("li");
        emailItems.forEach((li: any) => {
          const emailText = li.textContent?.trim() || "";
          const emailMatch = emailText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (emailMatch) {
            const email = emailMatch[1].toLowerCase();
            if (!email.includes("zabasearch") && !email.includes("intelius")) {
              profile.emails?.push({ email, type: "unknown" });
            }
          }
        });
      }
    }

    // Extract jobs
    const jobsSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
      h3.textContent?.trim() === "Jobs"
    );
    if (jobsSection) {
      const jobsList = jobsSection.parentElement?.querySelector("ul.showMore-list");
      if (jobsList) {
        const jobItems = jobsList.querySelectorAll("li");
        jobItems.forEach((li: any) => {
          const jobText = li.textContent?.trim() || "";
          const jobMatch = jobText.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s*\((.+?)\))?$/);
          if (jobMatch) {
            const titleCompany = jobMatch[1].trim();
            const company = jobMatch[2].trim();
            const dateRange = jobMatch[3]?.trim() || "";
            const titleMatch = titleCompany.match(/^(.+?)\s+(.+)$/);
            const title = titleMatch ? titleMatch[2] : titleCompany;
            
            let isCurrent = false;
            let since: string | undefined;
            let duration: string | undefined;
            
            if (dateRange.toLowerCase().includes("since")) {
              isCurrent = true;
              const sinceMatch = dateRange.match(/since\s+(\d{4})/i);
              if (sinceMatch) since = sinceMatch[1];
            } else if (dateRange.includes("-")) {
              duration = dateRange;
              const yearMatch = dateRange.match(/(\d{4})-(\d{4})/);
              if (yearMatch) {
                const endYear = parseInt(yearMatch[2]);
                const currentYear = new Date().getFullYear();
                isCurrent = endYear >= currentYear - 1;
              }
            }
            
            profile.jobs?.push({
              company,
              title,
              current: isCurrent,
              since,
              duration
            });
          } else if (jobText.length > 3) {
            profile.jobs?.push({ company: jobText });
          }
        });
      }
    }

    // Extract education
    const educationSection = Array.from(personDiv.querySelectorAll("h3")).find((h3: any) => 
      h3.textContent?.trim() === "Education"
    );
    if (educationSection) {
      const educationList = educationSection.parentElement?.querySelector("ul.showMore-list");
      if (educationList) {
        const educationItems = educationList.querySelectorAll("li");
        educationItems.forEach((li: any) => {
          const eduText = li.textContent?.trim() || "";
          const eduMatch = eduText.match(/^(.+?)\s+from\s+(.+?)(?:\s*\((.+?)\))?$/);
          if (eduMatch) {
            const degreeField = eduMatch[1].trim();
            const school = eduMatch[2].trim();
            const dates = eduMatch[3]?.trim();
            const degreeParts = degreeField.split(",").map(p => p.trim());
            const degree = degreeParts[0] || degreeField;
            const fieldOfStudy = degreeParts[1];
            
            profile.education?.push({
              school,
              degree: fieldOfStudy ? `${degree}, ${fieldOfStudy}` : degree,
              dates
            });
          } else if (eduText.length > 3) {
            profile.education?.push({ school: eduText });
          }
        });
      }
    }

    return profile;
  }

  /**
   * Convert PersonProfile to QuickScanProfileData format
   */
  private convertPersonProfileToQuickScanProfileData(
    profile: PersonProfile,
    url: string
  ): QuickScanProfileData {
    const profileData = createEmptyProfileData();
    
    profileData.name = profile.name;
    const nameParts = profile.name.split(" ");
    profileData.first_name = nameParts[0];
    profileData.last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined;
    profileData.middle_name = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : undefined;
    profileData.age = profile.age;

    profileData.phones = (profile.phones || []).map(p => ({
      number: p.number,
      type: p.type,
      provider: p.provider,
      is_primary: p.primary,
    }));

    profileData.emails = (profile.emails || []).map(e => ({
      email: e.email,
      type: e.type,
    }));

    profileData.addresses = (profile.addresses || []).map(a => ({
      full_address: a.full_address || a.address,
      street: a.street,
      city: a.city,
      state: a.state,
      zip: a.zip,
      county: a.county,
      is_current: a.is_last_known,
      years_lived: a.years_lived,
      property_type: a.property_type,
    }));

    profileData.relatives = (profile.relatives || []).map(r => ({
      name: r.name,
      relationship: r.relationship,
      age: r.age,
      gender: r.gender,
    }));

    profileData.aliases = (profile.aliases || []).map(a => a.alias);

    profileData.jobs = (profile.jobs || []).map(j => ({
      company: j.company,
      title: j.title,
      location: j.location,
      is_current: j.current,
      start_date: j.since,
      duration: j.duration || j.date_range,
    }));

    profileData.education = (profile.education || []).map(e => ({
      school: e.school,
      degree: e.degree,
      dates: e.dates,
    }));

    profileData.scraped_at = new Date().toISOString();
    profileData.sources = [this.name];
    profileData.detail_link = url;

    return profileData;
  }

  override async scrapeFullProfile(url: string, selectedProfile?: Partial<PersonProfile>): Promise<QuickScanProfileData | null> {
    // Check if this is a search results page (contains #CTA anchor or is search results URL pattern)
    // For Zabasearch, search results pages contain all full profile data
    const isSearchResultsPage = url.includes('#CTA') || 
      (url.includes('/people/') && url.match(/\/people\/[^/]+\/[^/]+\/[^/]+$/));
    
    if (isSearchResultsPage) {
      console.log(`🔍 Zabasearch - Detected search results page, extracting specific profile...`);
      
      // Remove anchor from URL
      const baseUrl = url.split('#')[0];
      
      // Re-fetch the search results page
      const html = await this.fetchWithProxy(baseUrl);
      if (!html) {
        console.error('❌ Failed to fetch search results page');
        return null;
      }
      
      const doc = this.parseHtml(html);
      if (!doc) {
        console.error('❌ Failed to parse search results page');
        return null;
      }
      
      // Extract all profiles from the page
      const personDivs = doc.querySelectorAll("div.person");
      console.log(`🔍 Found ${personDivs.length} profiles on search results page`);
      
      // Find the matching profile by name/age
      let matchedProfile: PersonProfile | null = null;
      for (let i = 0; i < personDivs.length; i++) {
        const personDiv = personDivs[i];
        const id = personDiv.getAttribute("data-id") || `zaba-${i}`;
        const nameElement = personDiv.querySelector("h2 a");
        const ageElement = personDiv.querySelector("h3");
        const name = nameElement?.textContent?.trim() || "";
        const age = ageElement?.textContent?.trim();
        
        // Match by name and age if provided
        if (selectedProfile) {
          const nameMatch = !selectedProfile.name || 
            name.toLowerCase().includes(selectedProfile.name.toLowerCase()) ||
            selectedProfile.name.toLowerCase().includes(name.toLowerCase());
          const ageMatch = !selectedProfile.age || age === selectedProfile.age;
          
          if (nameMatch && ageMatch) {
            console.log(`✅ Matched profile: ${name}, age: ${age}`);
            matchedProfile = await this.extractFullProfileFromDiv(personDiv, name, age, id);
            break;
          }
        } else {
          // If no selectedProfile provided, use the first profile
          if (i === 0) {
            matchedProfile = await this.extractFullProfileFromDiv(personDiv, name, age, id);
            break;
          }
        }
      }
      
      if (!matchedProfile) {
        console.error('❌ Could not find matching profile on search results page');
        return null;
      }
      
      // Convert to QuickScanProfileData format
      return this.convertPersonProfileToQuickScanProfileData(matchedProfile, url);
    }
    
    // Otherwise, treat as detail page (legacy behavior)
    const legacyProfile = await this.scrapeDetails(url);
    if (!legacyProfile) return null;

    // Convert to new format using the utility function
    const profileData = createEmptyProfileData();

    // Map name parts
    profileData.name = legacyProfile.name;
    const nameParts = legacyProfile.name.split(" ");
    profileData.first_name = nameParts[0];
    profileData.last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined;
    profileData.middle_name = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : undefined;
    profileData.age = legacyProfile.age;

    // Map phones
    profileData.phones = (legacyProfile.phones || []).map(p => ({
      number: p.number,
      type: p.type,
      provider: p.provider,
      is_primary: p.primary,
    }));

    // Map emails
    profileData.emails = (legacyProfile.emails || []).map(e => ({
      email: e.email,
      type: e.type,
    }));

    // Map addresses
    profileData.addresses = (legacyProfile.addresses || []).map(a => ({
      full_address: a.full_address || a.address,
      street: a.street,
      city: a.city,
      state: a.state,
      zip: a.zip,
      county: a.county,
      is_current: a.is_last_known,
      years_lived: a.years_lived,
      property_type: a.property_type,
    }));

    // Map relatives
    profileData.relatives = (legacyProfile.relatives || []).map(r => ({
      name: r.name,
      relationship: r.relationship,
      age: r.age,
      gender: r.gender,
    }));

    // Map aliases (convert from object to string array)
    profileData.aliases = (legacyProfile.aliases || []).map(a => a.alias);

    // Map jobs
    profileData.jobs = (legacyProfile.jobs || []).map(j => ({
      company: j.company,
      title: j.title,
      location: j.location,
      is_current: j.current,
      start_date: j.since,
      duration: j.duration || j.date_range,
    }));

    // Map education
    profileData.education = (legacyProfile.education || []).map(e => ({
      school: e.school,
      degree: e.degree,
      dates: e.dates,
    }));

    // Metadata
    profileData.scraped_at = new Date().toISOString();
    profileData.sources = [this.name];
    profileData.detail_link = url;

    return profileData;
  }
}
