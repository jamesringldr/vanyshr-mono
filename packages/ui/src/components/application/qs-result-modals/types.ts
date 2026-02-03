/**
 * Quick Scan result profile summary — data returned from search for user to confirm or select.
 * Used by QSResultSingleModal and QSResultMultipleModal.
 */
export interface QSProfileSummary {
    /** Unique id (e.g. from API) for sending full profile URL to edge function */
    id: string;
    /** Full name as shown on the record */
    fullName: string;
    /** Age if available */
    age?: number;
    /** Aliases / other names */
    aliases?: string[];
    /** Phone numbers */
    phones?: string[];
    /** Relative names */
    relatives?: string[];
    /** Current address lines */
    currentAddress?: string[];
}
