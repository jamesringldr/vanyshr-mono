// AnyWho Scraper - Uses free CORS proxies (no Cloudflare protection)
import { BaseScraper, PersonProfile, ProfileMatch, QuickScanProfileData, SearchInput, SearchType, convertToQuickScanProfileData } from "./BaseScraper.ts";

export class AnyWhoScraper extends BaseScraper {
  name = "AnyWho";
  supportedSearchTypes: SearchType[] = ["name"];

  // Free CORS proxies work fine for AnyWho
  private corsProxies = [
    "https://corsproxy.io/?",
    "https://api.codetabs.com/v1/proxy?quest=",
    "https://api.allorigins.win/raw?url=",
  ];

  private stateNames: { [key: string]: string } = {
    AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas",
    CA: "california", CO: "colorado", CT: "connecticut", DE: "delaware",
    DC: "district-of-columbia", FL: "florida", GA: "georgia", HI: "hawaii",
    ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
    KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine",
    MD: "maryland", MA: "massachusetts", MI: "michigan", MN: "minnesota",
    MS: "mississippi", MO: "missouri", MT: "montana", NE: "nebraska",
    NV: "nevada", NH: "new-hampshire", NJ: "new-jersey", NM: "new-mexico",
    NY: "new-york", NC: "north-carolina", ND: "north-dakota", OH: "ohio",
    OK: "oklahoma", OR: "oregon", PA: "pennsylvania", RI: "rhode-island",
    SC: "south-carolina", SD: "south-dakota", TN: "tennessee", TX: "texas",
    UT: "utah", VT: "vermont", VA: "virginia", WA: "washington",
    WV: "west-virginia", WI: "wisconsin", WY: "wyoming",
  };

  private async fetchWithProxy(targetUrl: string): Promise<string | null> {
    console.log(`🔍 AnyWho - Target URL: ${targetUrl}`);

    for (let i = 0; i < this.corsProxies.length; i++) {
      const proxy = this.corsProxies[i];
      const proxyUrl = `${proxy}${encodeURIComponent(targetUrl)}`;

      console.log(`🔍 AnyWho - Trying proxy ${i + 1}/${this.corsProxies.length}: ${proxy}`);

      try {
        const response = await fetch(proxyUrl, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        });

        if (!response.ok) {
          console.log(`🔍 AnyWho - Proxy ${i + 1} failed with status: ${response.status}`);
          continue;
        }

        const html = await response.text();

        if (html.includes("Just a moment...") || html.includes("Checking your browser") || html.includes("Access denied")) {
          console.log(`🔍 AnyWho - Proxy ${i + 1} got blocked, trying next...`);
          continue;
        }

        console.log(`🔍 AnyWho - Proxy ${i + 1} success! HTML length: ${html.length}`);
        return html;
      } catch (error) {
        console.error(`🔍 AnyWho - Proxy ${i + 1} error:`, error);
        continue;
      }
    }

    console.log(`🔍 AnyWho - All CORS proxies failed`);
    return null;
  }

  async scrape(
    firstName: string,
    lastName: string,
    city?: string,
    state?: string,
  ): Promise<PersonProfile[]> {
    const formattedName = `${this.formatNameForUrl(firstName)}+${this.formatNameForUrl(lastName)}`;
    let url = `https://www.anywho.com/people/${formattedName}`;

    if (state) {
      const stateName = this.stateNames[state.toUpperCase()] || state.toLowerCase();
      url += `/${stateName}`;
      if (city) {
        url += `/${this.formatNameForUrl(city)}`;
      }
    }

    const html = await this.fetchWithProxy(url);
    if (!html) return [];

    const doc = this.parseHtml(html);
    if (!doc) return [];

    const profiles: PersonProfile[] = [];
    const h2Elements = Array.from(doc.querySelectorAll("h2"));

    const cards = h2Elements.map((h2: any) => {
      const h2Text = h2.textContent?.trim() || "";
      if (!h2Text.toLowerCase().includes(firstName.toLowerCase()) &&
          !h2Text.toLowerCase().includes(lastName.toLowerCase())) {
        return null;
      }
      let parent = h2.parentElement;
      let attempts = 0;
      while (parent && attempts < 5) {
        if (parent.textContent?.includes("Lives in:")) {
          return { card: parent, nameH2: h2 };
        }
        parent = parent.parentElement;
        attempts++;
      }
      return null;
    }).filter((item: any) => item !== null);

    const uniqueItems: any[] = [];
    const seenCards = new Set();
    for (const item of cards) {
      if (item && !seenCards.has(item.card)) {
        seenCards.add(item.card);
        uniqueItems.push(item);
      }
    }

    uniqueItems.forEach((item, index) => {
      try {
        const card = item.card;
        const text = card.textContent || "";

        let name = item.nameH2.textContent?.trim() || "";
        const ageMatch = text.match(/Age\s+(\d+)/);
        const age = ageMatch ? ageMatch[1] : undefined;

        let cityState = undefined;
        const addresses: Array<{ address?: string; city?: string; state?: string; zip?: string; type?: string }> = [];
        const livesInMatch = text.match(/Lives in:\s*([^]+?)(?:Used to live|Phone|Email|Related to|AKA|View Details|$)/i);
        if (livesInMatch) {
          let addr = livesInMatch[1].trim();
          const lines = addr.split("\n");
          if (lines.length > 0) addr = lines[0].trim();
          cityState = addr;
          
          // Parse address into structured format
          // AnyWho format can be: "Street Address, City, State ZIP" or "City, State ZIP" or "Street, City State ZIP"
          // Try full format first: "Street, City, State ZIP"
          const fullAddrMatch = addr.match(/^(.+?),\s*([^,]+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
          if (fullAddrMatch) {
            addresses.push({
              address: fullAddrMatch[1].trim(),
              city: fullAddrMatch[2].trim(),
              state: fullAddrMatch[3],
              zip: fullAddrMatch[4],
              type: 'current'
            });
          } else {
            // Try format without comma: "Street, City State ZIP"
            const noCommaMatch = addr.match(/^(.+?),\s*([A-Za-z\s]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
            if (noCommaMatch) {
              addresses.push({
                address: noCommaMatch[1].trim(),
                city: noCommaMatch[2].trim(),
                state: noCommaMatch[3],
                zip: noCommaMatch[4],
                type: 'current'
              });
            } else {
              // Try city, state zip format: "City, State ZIP"
              const cityStateZipMatch = addr.match(/^([^,]+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
              if (cityStateZipMatch) {
                addresses.push({
                  city: cityStateZipMatch[1].trim(),
                  state: cityStateZipMatch[2],
                  zip: cityStateZipMatch[3],
                  type: 'current'
                });
              } else {
                // Fallback: try to extract at least city and state
                const cityStateMatch = addr.match(/^([^,]+?),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/);
                if (cityStateMatch) {
                  addresses.push({
                    city: cityStateMatch[1].trim(),
                    state: cityStateMatch[2],
                    zip: cityStateMatch[3],
                    type: 'current'
                  });
                } else {
                  // Last resort: store as address string
                  addresses.push({
                    address: addr,
                    type: 'current'
                  });
                }
              }
            }
          }
        }

        const phones: Array<{ number: string; type?: string; primary?: boolean }> = [];
        // Match all phone numbers after "Phone number(s):"
        const phoneSectionMatch = text.match(/Phone number\(s\):\s*([^]+?)(?:Email|Related to|AKA|Lives in|Used to live|View Details|$)/i);
        if (phoneSectionMatch) {
          const phoneSection = phoneSectionMatch[1];
          // Match all phone numbers in format (XXX) XXX-XXXX
          const phonePattern = /(\(\d{3}\)\s*\d{3}-\d{4})/g;
          const phoneMatches = phoneSection.matchAll(phonePattern);
          let phoneIndex = 0;
          for (const match of phoneMatches) {
            phones.push({ number: match[1], type: "unknown", primary: phoneIndex === 0 });
            phoneIndex++;
          }
        }

        const aliases: Array<{ alias: string }> = [];
        const akaMatch = text.match(/AKA[:\s]+([^]+?)(?:Lives in|Used to live|Phone|Email|Related to|View Details|$)/i);
        if (akaMatch) {
          const aliasList = akaMatch[1].trim().split(/[,\n•]/).map((a: string) => a.trim()).filter((a: string) => a.length > 0);
          aliasList.forEach((alias: string) => {
            if (alias.length > 2 && !alias.toLowerCase().includes("aka")) {
              aliases.push({ alias });
            }
          });
        }

        const relatives: Array<{ name: string; relationship?: string; age?: string }> = [];
        const relatedMatch = text.match(/(?:May be related to|Related to)[:\s]+([^]+?)(?:View Details|Email|Phone|AKA|\+\s*\d+\s*more|$)/i);
        if (relatedMatch) {
          let relativeText = relatedMatch[1].trim();
          // Stop at "+x more" patterns
          const moreMatch = relativeText.match(/^(.+?)\s*\+\s*\d+\s*more/i);
          if (moreMatch) {
            relativeText = moreMatch[1].trim();
          }
          const relativeList = relativeText.split(/[,\n•]/).map((r: string) => r.trim()).filter((r: string) => r.length > 0);
          relativeList.forEach((relative: string) => {
            // Skip if it contains "+x more" or "Social Profiles"
            if (relative.match(/\+\s*\d+\s*more/i) || relative.toLowerCase().includes("social profiles")) {
              return;
            }
            if (relative.length > 2 && !relative.toLowerCase().includes("related")) {
              const ageMatch = relative.match(/,?\s*(\d+)\s*$/);
              const relAge = ageMatch ? ageMatch[1] : undefined;
              const relName = ageMatch ? relative.replace(/,?\s*\d+\s*$/, "").trim() : relative;
              if (relName.length > 2) {
                relatives.push({ name: relName, relationship: "family", age: relAge });
              }
            }
          });
        }

        let detailLink = undefined;
        const links = card.querySelectorAll("a");
        for (const link of links) {
          if (link.textContent?.includes("View Details")) {
            const href = link.getAttribute("href");
            if (href) {
              detailLink = href.startsWith("http") ? href : `https://www.anywho.com${href}`;
            }
            break;
          }
        }

        const nameLower = name.toLowerCase();
        if (nameLower.includes("summary") || nameLower.includes("overview") || name.length < 3) {
          return;
        }
        if (!detailLink) {
          return;
        }

        profiles.push({
          id: `aw-${index}`,
          name: name || `${firstName} ${lastName}`,
          age,
          city_state: cityState,
          current_address: cityState, // For modal display (backward compatibility)
          phone_snippet: phones.length > 0 ? phones[0].number : undefined,
          current_phone: phones.length > 0 ? phones[0].number : undefined, // For modal display
          phones: phones.length > 0 ? phones : undefined,
          addresses: addresses.length > 0 ? addresses : undefined,
          aliases: aliases.length > 0 ? aliases : undefined,
          relatives: relatives.length > 0 ? relatives : undefined,
          detail_link: detailLink,
          source: "AnyWho",
        });
      } catch (e) {
        console.error(`Error parsing AnyWho card ${index}:`, e);
      }
    });

    return profiles;
  }

  /**
   * Override searchProfiles to preserve phone data for modal display
   * AnyWho search results include phone numbers, so we preserve them
   */
  override async searchProfiles(input: SearchInput): Promise<ProfileMatch[]> {
    const profiles = await this.scrape(
      input.first_name || "",
      input.last_name || "",
      input.city,
      input.state
    );

    // Convert to ProfileMatch but preserve full profile data for phones
    return profiles.map(p => ({
      id: p.id,
      name: p.name,
      age: p.age,
      city_state: p.city_state,
      phone_snippet: p.phone_snippet,
      detail_link: p.detail_link,
      source: this.name,
      // Include full profile data so phones array is available for modal
      fullProfile: p,
    }));
  }

  async scrapeDetails(url: string): Promise<PersonProfile | null> {
    console.log(`🔍 AnyWho - Scraping details from: ${url}`);
    const html = await this.fetchWithProxy(url);
    if (!html) return null;

    const doc = this.parseHtml(html);
    if (!doc) return null;

    const nameEl = doc.querySelector("h1.text-display-sm") || doc.querySelector("h1");
    let name = nameEl?.textContent?.trim() || "";

    if (!name) {
      console.warn(`⚠️ AnyWho - scrapeDetails failed: No name found`);
      return null;
    }

    let age: string | undefined = undefined;
    const nameAgeMatch = name.match(/^(.+?),\s*(\d+)$/);
    if (nameAgeMatch) {
      name = nameAgeMatch[1].trim();
      age = nameAgeMatch[2];
    }

    const profile: PersonProfile = {
      id: "details",
      name,
      age,
      source: "AnyWho",
      phones: [],
      emails: [],
      addresses: [],
      relatives: [],
      aliases: [],
      family_records: [],
      legal_records: [],
      background_records: [],
      assets: [],
      current_phone: undefined,
      additional_numbers: [],
      current_address: undefined,
      past_addresses: [],
    };

    const bodyElement = (doc as any).body || doc.documentElement || doc;
    const bodyText = bodyElement?.textContent || "";

    // Extract aliases
    const akaMatch = bodyText.match(/Aka:\s*([^\n]+?)(?:Background Check|View More|CURRENT ADDRESS|PREVIOUS|CONTACT|EMAIL|POSSIBLE|ONLINE|$)/i);
    if (akaMatch) {
      const aliasList = akaMatch[1].trim().split(/[,•]/).map((a: string) => a.trim()).filter((a: string) => a.length > 2);
      aliasList.forEach((alias: string) => {
        if (!alias.toLowerCase().includes("aka") && 
            !alias.toLowerCase().includes("view") && 
            !alias.toLowerCase().includes("background")) {
          profile.aliases?.push({ alias });
        }
      });
    }

    // Extract phones
    const seenPhones = new Set<string>();
    const allTelLinks = doc.querySelectorAll("a[href^='tel:']");
    allTelLinks.forEach((link: any, index: number) => {
      const phoneNumber = link.textContent?.trim().replace(/\D/g, "") || "";
      const formattedPhone = link.textContent?.trim() || "";

      if (phoneNumber.length >= 10 && !seenPhones.has(phoneNumber)) {
        seenPhones.add(phoneNumber);

        let phoneType = "unknown";
        let provider = "";

        const parentDiv = link.parentElement;
        if (parentDiv) {
          const containerText = parentDiv.textContent || "";
          const carrierMatch = containerText.match(/•\s*([A-Za-z&\s-]+?)(?:\s*$|\s*View)/);
          if (carrierMatch) provider = carrierMatch[1].trim();
          if (provider.includes("T-Mobile") || provider.includes("AT&T") || provider.includes("Verizon")) {
            phoneType = "mobile";
          }
        }

        profile.phones?.push({
          number: formattedPhone,
          type: phoneType,
          provider: provider || undefined,
          primary: index === 0,
        });

        if (index === 0) {
          profile.current_phone = formattedPhone;
        } else {
          profile.additional_numbers?.push(formattedPhone);
        }
      }
    });

    // Fallback phone extraction from text
    if (profile.phones?.length === 0) {
      const phonePattern = /(\d{3}[-.]?\d{3}[-.]?\d{4})/g;
      const phoneMatches = bodyText.matchAll(phonePattern);
      let phoneIndex = 0;

      for (const match of phoneMatches) {
        const cleanPhone = match[1].replace(/\D/g, "");
        if (cleanPhone.length === 10 && !seenPhones.has(cleanPhone)) {
          seenPhones.add(cleanPhone);
          const formatted = `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;
          profile.phones?.push({ number: formatted, type: "unknown", primary: phoneIndex === 0 });
          if (phoneIndex === 0) profile.current_phone = formatted;
          else profile.additional_numbers?.push(formatted);
          phoneIndex++;
        }
      }
    }

    console.log(`📞 Found ${profile.phones?.length || 0} phone numbers`);

    // Extract emails
    // Try multiple selectors for email section
    let emailsSection = doc.getElementById("emails") || 
                       doc.querySelector('[id*="email" i]') ||
                       doc.querySelector('[class*="email" i]');
    
    // Pattern to match emails, including masked ones with asterisks
    // Match email pattern and ensure it ends at TLD boundary
    const emailPattern = /\b([a-zA-Z0-9*._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})\b/g;
    const seenEmails = new Set<string>();
    
    if (emailsSection) {
      // Try to find list items or specific email containers
      const emailItems = emailsSection.querySelectorAll("li, div, span");
      for (const item of emailItems) {
        const itemText = item.textContent || "";
        const emailMatches = itemText.matchAll(emailPattern);
        for (const match of emailMatches) {
          let email = match[1].toLowerCase().trim();
          // Clean email - remove any trailing non-email characters
          email = email.replace(/[^a-zA-Z0-9*._%+-@]/g, "").split(/\s/)[0];
          // Ensure we have a valid email format
          if (email && email.includes("@") && email.includes(".") &&
              !seenEmails.has(email) && 
              !email.includes("anywho") && 
              !email.includes("example") &&
              email.length > 5 &&
              email.match(/^[a-zA-Z0-9*._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/)) {
            seenEmails.add(email);
            profile.emails?.push({ email: email, type: "unknown" });
          }
        }
      }
      
      // Fallback: search entire section text
      if (profile.emails?.length === 0) {
        const emailMatches = (emailsSection.textContent || "").matchAll(emailPattern);
        for (const match of emailMatches) {
          let email = match[1].toLowerCase().trim();
          email = email.replace(/[^a-zA-Z0-9*._%+-@]/g, "").split(/\s/)[0];
          if (email && email.includes("@") && email.includes(".") &&
              !seenEmails.has(email) && 
              !email.includes("anywho") && 
              !email.includes("example") &&
              email.length > 5 &&
              email.match(/^[a-zA-Z0-9*._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/)) {
            seenEmails.add(email);
            profile.emails?.push({ email: email, type: "unknown" });
          }
        }
      }
    }
    
    // Fallback: search entire body for email patterns, but be more selective
    if (profile.emails?.length === 0) {
      // Look for email patterns in context (e.g., "Email: m*****@aol.com")
      const emailContextPattern = /(?:email|address)[:\s]+([a-zA-Z0-9*._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})\b/gi;
      const bodyEmailMatches = bodyText.matchAll(emailContextPattern);
      for (const match of bodyEmailMatches) {
        let email = match[1].toLowerCase().trim();
        email = email.replace(/[^a-zA-Z0-9*._%+-@]/g, "").split(/\s/)[0];
        if (email && email.includes("@") && email.includes(".") &&
            !seenEmails.has(email) && 
            !email.includes("anywho") && 
            !email.includes("example") &&
            email.length > 5 &&
            email.match(/^[a-zA-Z0-9*._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/)) {
          seenEmails.add(email);
          profile.emails?.push({ email: email, type: "unknown" });
        }
      }
    }

    // Extract addresses
    const addressesSection = doc.getElementById("addresses");
    const seenAddresses = new Set<string>();

    if (addressesSection) {
      const addressHeadings = addressesSection.querySelectorAll("h4");
      addressHeadings.forEach((heading: any, index: number) => {
        const streetText = heading.textContent?.trim() || "";
        if (!streetText || !/\d/.test(streetText) || streetText.length < 5) return;
        if (streetText.includes("Address History") || streetText.includes("We found")) return;

        const container = heading.parentElement;
        if (!container) return;
        const containerText = container.textContent || "";

        let city = "", state = "", zip = "", yearsLived = "", propertyType = "";
        let isLastKnown = index === 0;

        const locationMatch = containerText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})(?:,?\s*(\d{5}))?/);
        if (locationMatch) {
          city = locationMatch[1].trim();
          state = locationMatch[2].trim();
          zip = locationMatch[3] || "";
        }

        const dateRangeMatch = containerText.match(/(\d{4})\s*[-–]\s*(\d{4}|\bPresent\b)/i);
        if (dateRangeMatch) yearsLived = `${dateRangeMatch[1]}-${dateRangeMatch[2]}`;

        const propertyMatch = containerText.match(/(?:this|in this)\s+(Single Family|High-Rise|Apartment|Condo|Duplex|Mobile Home|Townhouse)/i);
        if (propertyMatch) propertyType = propertyMatch[1].trim();

        if (containerText.includes("CURRENT") || containerText.includes("has resided here")) {
          isLastKnown = true;
        }

        const fullAddress = zip ? `${streetText}, ${city}, ${state} ${zip}` : city && state ? `${streetText}, ${city}, ${state}` : streetText;
        const addressKey = `${streetText}|${city}|${state}`;

        if (!seenAddresses.has(addressKey) && streetText.length > 5) {
          seenAddresses.add(addressKey);
          profile.addresses?.push({
            street: streetText,
            city: city || undefined,
            state: state || undefined,
            zip: zip || undefined,
            full_address: fullAddress,
            years_lived: yearsLived || undefined,
            is_last_known: isLastKnown,
            type: isLastKnown ? "current" : "history",
            property_type: propertyType || undefined,
          });

          if (isLastKnown && !profile.current_address) {
            profile.current_address = fullAddress;
          } else {
            profile.past_addresses?.push(fullAddress);
          }
        }
      });
    }

    // Extract relatives
    const seenRelatives = new Set<string>();
    const relativePattern = /Relative\s+data\s+re\s*s?\s*ult[:\s]+([A-Za-z\s]+?)\s*(Female|Male)\s*[•·\-]\s*(\d+)/gi;
    const relativeMatches = bodyText.matchAll(relativePattern);

    for (const match of relativeMatches) {
      const relName = match[1].trim();
      const gender = match[2];
      const relAge = match[3];
      const nameKey = relName.toLowerCase();

      if (!seenRelatives.has(nameKey) && relName.length > 2) {
        seenRelatives.add(nameKey);
        profile.relatives?.push({ name: relName, age: relAge, gender, relationship: "family" });
        profile.family_records?.push({ name: relName, age: relAge, gender });
      }
    }

    // Fallback relative patterns
    if (profile.relatives?.length === 0) {
      const globalPattern = /([A-Z][a-z]+(?:\s+[A-Z]?\s*[a-z]*)+)\s*(Female|Male)\s*[•·\-]\s*(\d{1,3})/g;
      const globalMatches = bodyText.matchAll(globalPattern);

      for (const match of globalMatches) {
        const relName = match[1].trim();
        const gender = match[2];
        const relAge = match[3];
        const nameKey = relName.toLowerCase();

        if (relName.includes("Summary") || relName.includes("Profile") || relName.includes("Record")) continue;

        if (!seenRelatives.has(nameKey) && relName.length > 3) {
          seenRelatives.add(nameKey);
          profile.relatives?.push({ name: relName, age: relAge, gender, relationship: "family" });
          profile.family_records?.push({ name: relName, age: relAge, gender });
        }
      }
    }

    console.log(`👨‍👩‍👧 Found ${profile.relatives?.length || 0} relatives`);

    // Extract assets
    const assetPattern1 = bodyText.match(/found\s+(\d+)\s+asset[s]?[^$]*?(?:totaling|worth)\s+\$?([\d,]+)/i);
    if (assetPattern1) {
      profile.assets?.push({ 
        type: "Total Assets",
        asset_count: parseInt(assetPattern1[1]),
        value: `$${assetPattern1[2]}`,
        description: `${assetPattern1[1]} asset(s) totaling $${assetPattern1[2]}`
      });
    } else {
      const netWorthMatch = bodyText.match(/(?:total\s+)?net\s+worth\s+of\s+\$?([\d,]+)/i);
      if (netWorthMatch) {
        profile.assets?.push({ 
          type: "Net Worth",
          asset_count: 1,
          value: `$${netWorthMatch[1]}`,
          description: `Net worth: $${netWorthMatch[1]}`
        });
      }
    }

    console.log(`💰 Found ${profile.assets?.length || 0} asset records`);

    // Extract legal records
    const courtSection = doc.getElementById("court-records");
    if (courtSection) {
      const gridDivs = courtSection.querySelectorAll(".grid > div");
      gridDivs.forEach((div: any) => {
        const boldP = div.querySelector("p.font-bold");
        const lastP = div.querySelector("p:last-of-type");
        const recordType = boldP?.textContent?.trim() || "";
        const descriptionText = lastP?.textContent?.trim() || "";

        if (recordType || descriptionText) {
          const countMatch = descriptionText.match(/(\d+)\s+court\s+search/i);
          const locationMatch = descriptionText.match(/in the\s+([^.]+)\./i);
          profile.legal_records?.push({
            record_type: recordType || undefined,
            record_count: countMatch ? parseInt(countMatch[1]) : undefined,
            record_location: locationMatch ? locationMatch[1].trim() : undefined,
            description: descriptionText || undefined,
          });
        }
      });
    }

    // Extract background records
    const historySection = doc.getElementById("personal-history");
    if (historySection) {
      const recordHeaders = historySection.querySelectorAll("h3.font-bold, h3");
      recordHeaders.forEach((header: any) => {
        const recordType = header.textContent?.trim() || "";
        const descriptionP = header.nextElementSibling;
        const descriptionText = descriptionP?.textContent?.trim() || "";

        if (recordType || descriptionText) {
          const dateMatch = descriptionText.match(/(\d{1,2}\/\d{4})/);
          const locationMatch = descriptionText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})/);
          profile.background_records?.push({
            record_type: recordType || undefined,
            description: descriptionText || undefined,
            event_date: dateMatch ? dateMatch[1] : undefined,
            location: locationMatch ? `${locationMatch[1]}, ${locationMatch[2]}` : undefined,
          });
        }
      });
    }

    // Fallback background record extraction from body text
    if (profile.background_records?.length === 0) {
      const bornMatch = bodyText.match(/(?:may have been )?born\s+on\s+(\d{1,2}\/\d{4})\s+in\s+([^.•\n]+)/i);
      if (bornMatch) {
        profile.background_records?.push({
          record_type: "Birth Record",
          description: `May have been born on ${bornMatch[1]} in ${bornMatch[2].trim()}`,
          event_date: bornMatch[1],
          location: bornMatch[2].trim(),
        });
      }

      const deathMatch = bodyText.match(/(?:may have )?passed\s+away\s+on\s+(\d{1,2}\/\d{4})\s+in\s+([^.•\n]+)/i);
      if (deathMatch) {
        profile.background_records?.push({
          record_type: "Death Record",
          description: `May have passed away on ${deathMatch[1]} in ${deathMatch[2].trim()}`,
          event_date: deathMatch[1],
          location: deathMatch[2].trim(),
        });
      }
    }

    console.log(`📋 Found ${profile.background_records?.length || 0} background records`);

    console.log(`✅ AnyWho - Scraped profile for ${name}:`, {
      phones: profile.phones?.length || 0,
      addresses: profile.addresses?.length || 0,
      relatives: profile.relatives?.length || 0,
      aliases: profile.aliases?.length || 0,
      assets: profile.assets?.length || 0,
    });

    return profile;
  }

  /**
   * Override scrapeFullProfile to convert PersonProfile to QuickScanProfileData
   */
  override async scrapeFullProfile(
    url: string,
    selectedProfile?: Partial<PersonProfile>
  ): Promise<QuickScanProfileData | null> {
    console.log(`🔍 AnyWho - scrapeFullProfile: ${url}`);
    
    // Use scrapeDetails to get PersonProfile
    const personProfile = await this.scrapeDetails(url);
    
    if (!personProfile) {
      console.error('❌ AnyWho - scrapeDetails returned null');
      return null;
    }

    // Convert to QuickScanProfileData
    const profileData = convertToQuickScanProfileData(personProfile);
    
    console.log(`✅ AnyWho - Converted to QuickScanProfileData:`, {
      name: profileData.name,
      phones: profileData.phones?.length || 0,
      addresses: profileData.addresses?.length || 0,
      relatives: profileData.relatives?.length || 0,
    });

    return profileData;
  }
}






