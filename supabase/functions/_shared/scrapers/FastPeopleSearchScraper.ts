// FastPeopleSearch — HTML parsers ported from vanyshr-scraper-lab (manual upload + future live scrape)
import {
  BaseScraper,
  PersonProfile,
  ProfileMatch,
  QuickScanProfileData,
  SearchInput,
  SearchType,
  convertToQuickScanProfileData,
} from "./BaseScraper.ts";

export type FpsPageClassification = "success" | "blocked" | "no_results" | "unknown";

export class FastPeopleSearchScraper extends BaseScraper {
  name = "FastPeopleSearch";
  supportedSearchTypes: SearchType[] = ["name"];

  buildSearchUrl(input: SearchInput): string {
    const first = this.formatNameForUrl(input.first_name || "");
    const last = this.formatNameForUrl(input.last_name || "");
    let path = `${first}-${last}`;

    if (input.city && input.state) {
      path += `_${this.formatNameForUrl(input.city)}-${input.state.toLowerCase()}`;
    } else if (input.city) {
      path += `_${this.formatNameForUrl(input.city)}`;
    } else if (input.state) {
      path += `_${input.state.toLowerCase()}`;
    }

    return `https://www.fastpeoplesearch.com/name/${path}`;
  }

  classifyHtml(html: string): FpsPageClassification {
    const lc = html.toLowerCase();
    if (
      lc.includes("just a moment") ||
      lc.includes("checking your browser") ||
      lc.includes("access denied") ||
      (lc.includes("cloudflare") && html.length < 5000)
    ) {
      return "blocked";
    }
    if (lc.includes("no results found") || lc.includes("did not return any matches")) {
      return "no_results";
    }
    if (
      (html.length > 300 && lc.includes("fastpeoplesearch")) ||
      lc.includes("div.person") ||
      lc.includes('div.card')
    ) {
      return "success";
    }
    return "unknown";
  }

  parseMatchesFromHtml(html: string): ProfileMatch[] {
    const markdownMatches = this.parseMatchesFromMarkdown(html);
    if (markdownMatches.length > 0) return markdownMatches;

    const doc = this.parseHtml(html);
    if (!doc) return [];

    const cardMatches = this.parseMatchesFromFpsCards(doc);
    if (cardMatches.length > 0) return cardMatches;

    const results: ProfileMatch[] = [];
    const cards = Array.from(
      doc.querySelectorAll("a[href*='/name/'], a[href*='_id_']"),
    );
    const seen = new Set<string>();

    for (const [index, card] of cards.entries()) {
      const href = card.getAttribute("href");
      const name = (card.textContent || "").trim().replace(/\s+/g, " ");
      if (!href || name.length < 3) continue;
      if (name.toLowerCase().includes("view full report")) continue;

      const detailLink = href.startsWith("http")
        ? href
        : `https://www.fastpeoplesearch.com${href}`;

      const dedupeKey = `${name.toLowerCase()}-${detailLink.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      results.push({
        id: `fps-${index}`,
        name,
        detail_link: detailLink,
        source: this.name,
      });
    }

    return results;
  }

  private parseMatchesFromFpsCards(doc: any): ProfileMatch[] {
    const cards = Array.from(doc.querySelectorAll("div.card[id], div.card[data-link]"));
    if (cards.length === 0) return [];

    const results: ProfileMatch[] = [];
    const seen = new Set<string>();

    for (const [index, card] of cards.entries()) {
      const cardId = card.getAttribute("id") || `fps-card-${index}`;
      const dataLink = card.getAttribute("data-link") || "";
      const nameEl = card.querySelector("span.larger");
      const greyEl = card.querySelector("span.grey");

      const name = (nameEl?.textContent || "").trim().replace(/\s+/g, " ");
      if (name.length < 3) continue;

      const detailLink = dataLink
        ? (dataLink.startsWith("http")
          ? dataLink
          : `https://www.fastpeoplesearch.com${dataLink}`)
        : undefined;

      const greyText = (greyEl?.textContent || "").replace(/\s+/g, " ").trim();
      const ageMatch = greyText.match(/Age\s+(\d+)/i);
      const cityMatch = greyText.match(/•\s*(.+)$/) || greyText.match(/,\s*([A-Za-z\s]+,\s*[A-Z]{2})$/);
      const age = ageMatch ? ageMatch[1] : undefined;
      const cityState = cityMatch ? cityMatch[1].trim() : undefined;

      const key = `${name.toLowerCase()}-${detailLink || cardId}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        id: cardId,
        name,
        age,
        city_state: cityState,
        detail_link: detailLink,
        source: this.name,
      });
    }

    return results;
  }

  private parseMatchesFromMarkdown(content: string): ProfileMatch[] {
    const results: ProfileMatch[] = [];
    const seen = new Set<string>();
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)\s]+|\/[^\)\s]+)\)/g;
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = linkPattern.exec(content)) !== null) {
      const name = match[1].trim().replace(/\s+/g, " ");
      const rawHref = match[2].trim();
      const detailLink = rawHref.startsWith("http")
        ? rawHref
        : `https://www.fastpeoplesearch.com${rawHref}`;

      if (!detailLink.includes("fastpeoplesearch.com")) continue;
      if (!detailLink.includes("/name/") && !detailLink.includes("_id_")) continue;
      if (name.length < 3 || name.toLowerCase().includes("view full report")) continue;

      const key = `${name.toLowerCase()}-${detailLink.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        id: `fps-md-${index++}`,
        name,
        detail_link: detailLink,
        source: this.name,
      });
    }

    return results;
  }

  parseSearchFromHtml(_html: string, _firstName: string, _lastName: string): PersonProfile[] {
    const matches = this.parseMatchesFromHtml(_html);
    return matches.map((match) => ({
      id: match.id,
      name: match.name,
      age: match.age,
      city_state: match.city_state,
      phone_snippet: match.phone_snippet,
      detail_link: match.detail_link,
      source: this.name,
    }));
  }

  private isPersonDetailPage(html: string, doc: any): boolean {
    if (html.includes("page-details") || html.includes("personDetails")) return true;
    return Boolean(
      doc?.querySelector("#phone_number_section") ||
      doc?.querySelector("#details-header"),
    );
  }

  private parsePersonDetailPage(doc: any, url?: string): QuickScanProfileData | null {
    const fullName = doc.querySelector("#full_name_section .fullname")?.textContent?.trim() ||
      doc.querySelector("h1#details-header")?.textContent?.replace(/\s+/g, " ").trim() || "";
    if (!fullName || fullName.length < 3) return null;

    const age = doc.querySelector("#age-header")?.textContent?.match(/Age\s+(\d+)/i)?.[1];

    const phones: PersonProfile["phones"] = [];
    for (const dl of Array.from(doc.querySelectorAll("#phone_number_section .detail-box-phone dl"))) {
      const number = (dl as any).querySelector("dt a")?.textContent?.trim().replace(/\s+/g, " ") || "";
      if (number.replace(/\D/g, "").length < 10) continue;
      const dds = Array.from((dl as any).querySelectorAll("dd")).map((dd: any) => dd.textContent?.trim() || "");
      phones.push({
        number,
        type: dds[0]?.toLowerCase() || "unknown",
        provider: dds[1],
        primary: phones.length === 0,
        first_reported: dds.find((d: string) => /first reported/i.test(d))?.replace(/First reported\s*/i, "").trim(),
      });
    }

    const emails: PersonProfile["emails"] = [];
    for (const h3 of Array.from(doc.querySelectorAll("#email_section h3"))) {
      const email = (h3 as any).textContent?.trim();
      if (email?.includes("@")) emails.push({ email });
    }

    const aliases: Array<{ alias: string }> = [];
    for (const h3 of Array.from(doc.querySelectorAll("#aka-links h3"))) {
      const alias = (h3 as any).textContent?.trim();
      if (alias && alias.length > 2) aliases.push({ alias });
    }

    const addresses: PersonProfile["addresses"] = [];
    const currentLink = doc.querySelector("#current_address_section h3 a");
    if (currentLink) {
      const blockText = (currentLink.parentElement?.textContent || "").replace(/\s+/g, " ").trim();
      const street = currentLink.textContent?.replace(/\s+/g, " ").trim() || "";
      const csMatch = blockText.match(/([A-Za-z\s]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
      addresses.push({
        address: street,
        city: csMatch?.[1]?.trim(),
        state: csMatch?.[2],
        zip: csMatch?.[3],
        full_address: blockText,
        type: "current",
      });
    }
    for (const link of Array.from(doc.querySelectorAll("#previous-addresses dt.address-link a"))) {
      const text = (link as any).textContent?.replace(/\s+/g, " ").trim() || "";
      const csMatch = text.match(/^(.+?)\s+([A-Za-z\s.]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      addresses.push(csMatch
        ? { address: csMatch[1].trim(), city: csMatch[2].trim(), state: csMatch[3], zip: csMatch[4], full_address: text, type: "past" }
        : { full_address: text, type: "past" });
    }

    const relatives: PersonProfile["relatives"] = [];
    for (const dl of Array.from(doc.querySelectorAll("#relative-links dl"))) {
      const name = (dl as any).querySelector("dt a")?.textContent?.trim().replace(/\s+/g, " ");
      if (!name || name.length < 3) continue;
      const ageDd = (dl as any).querySelector("dd")?.textContent || "";
      relatives.push({ name, relationship: "family", age: ageDd.match(/Age\s+(\d+)/i)?.[1] });
    }

    const cityState = doc.querySelector("h1#details-header")?.textContent?.match(/in\s+([^(\n]+)/i)?.[1]?.trim();

    const profileData = convertToQuickScanProfileData({
      id: "fps-detail",
      name: fullName,
      age,
      city_state: cityState,
      detail_link: url,
      source: this.name,
      phones,
      emails,
      addresses,
      relatives,
      aliases,
    });
    profileData.detail_link = url;
    profileData.sources = [this.name];
    profileData.scraped_at = new Date().toISOString();
    return profileData;
  }

  parseDetailFromHtml(
    html: string,
    url?: string,
    selectedProfile?: Partial<PersonProfile>,
  ): QuickScanProfileData | null {
    if (this.classifyHtml(html) === "blocked") return null;

    const doc = this.parseHtml(html);
    if (doc && this.isPersonDetailPage(html, doc)) {
      return this.parsePersonDetailPage(doc, url);
    }

    const matches = this.parseMatchesFromHtml(html);
    if (matches.length === 0) return null;

    let match = matches[0];
    if (selectedProfile?.name || selectedProfile?.age) {
      const picked = matches.find((m) => {
        const nameMatch = !selectedProfile.name ||
          m.name.toLowerCase().includes(selectedProfile.name.toLowerCase()) ||
          selectedProfile.name.toLowerCase().includes(m.name.toLowerCase());
        const ageMatch = !selectedProfile.age || m.age === selectedProfile.age;
        return nameMatch && ageMatch;
      });
      if (picked) match = picked;
    }

    const dataLinkPath = match.detail_link?.replace("https://www.fastpeoplesearch.com", "") ?? "";
    const card = Array.from(doc?.querySelectorAll("div.card") ?? []).find((el: any) =>
      el.getAttribute("id") === match.id ||
      (dataLinkPath && el.getAttribute("data-link") === dataLinkPath)
    ) || doc?.querySelector("div.card");

    const relatives: Array<{ name: string; relationship?: string }> = [];
    const addresses: PersonProfile["addresses"] = [];

    if (card) {
      const h3s = Array.from(card.querySelectorAll("h3"));
      for (const h3 of h3s) {
        const label = (h3.textContent || "").toLowerCase();
        const section = h3.parentElement?.textContent || "";
        if (label.includes("past address")) {
          const parts = section.replace(/Past Addresses:/i, "").split("•").map((s) => s.trim()).filter(Boolean);
          for (const part of parts) {
            const [city, state] = part.split(",").map((s) => s.trim());
            addresses.push({
              full_address: part,
              city: city || undefined,
              state: state || undefined,
              type: "past",
            });
          }
        }
        if (label.includes("relative")) {
          const parts = section.replace(/Relatives:/i, "").split(/[•\n]/).map((s) => s.trim()).filter((s) => s.length > 2);
          for (const part of parts) {
            relatives.push({ name: part, relationship: "family" });
          }
        }
      }
    }

    if (match.city_state) {
      const [city, state] = match.city_state.split(",").map((s) => s.trim());
      addresses.unshift({
        full_address: match.city_state,
        city: city || undefined,
        state: state || undefined,
        type: "current",
      });
    }

    const personProfile: PersonProfile = {
      id: match.id,
      name: match.name,
      age: match.age,
      city_state: match.city_state,
      detail_link: url || match.detail_link,
      source: this.name,
      phones: [],
      emails: [],
      addresses,
      relatives,
      aliases: [],
    };

    const profileData = convertToQuickScanProfileData(personProfile);
    profileData.detail_link = url || match.detail_link;
    profileData.sources = [this.name];
    profileData.scraped_at = new Date().toISOString();
    return profileData;
  }

  async scrape(
    firstName: string,
    lastName: string,
    _city?: string,
    _state?: string,
  ): Promise<PersonProfile[]> {
    console.warn("FastPeopleSearch live scrape is not enabled in edge functions; use manual HTML upload.");
    return [];
  }

  override async searchProfiles(input: SearchInput): Promise<ProfileMatch[]> {
    console.warn("FastPeopleSearch live search is not enabled; use admin-parse-html with saved HTML.");
    return this.parseSearchFromHtml("", input.first_name || "", input.last_name || "")
      .map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
        city_state: p.city_state,
        phone_snippet: p.phone_snippet,
        detail_link: p.detail_link,
        source: this.name,
        fullProfile: p,
      }));
  }

  override async scrapeFullProfile(
    url: string,
    selectedProfile?: Partial<PersonProfile>,
  ): Promise<QuickScanProfileData | null> {
    console.warn("FastPeopleSearch live scrapeFullProfile is not enabled; use admin-parse-html.");
    return null;
  }
}
