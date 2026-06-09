import { LegalPoliciesContent } from "./legal";

export const englishLegalPolicies: LegalPoliciesContent = {
  title: "Policies & Terms",
  lastUpdated: "Last updated",
  sections: [
    {
      subtitle: "1. General Information about QNext",
      paragraphs: [
        "QNext is a social platform for movies and series.",
        "It allows users to discover, rate, comment on, recommend, save movies, follow users, and create friendships.",
        "Recommendations may be personalized based on ratings, preferences, interactions, and the user’s social activity.",
        "QNext is an independent platform.",
      ],
    },
    {
      subtitle: "2. QNext Rating System",
      paragraphs: [
        "External ratings are used as an initial reference while QNext builds its own rating base.",
        "When a movie or series has fewer than 5,000 votes on IMDb, QNext may apply an internal adjustment or reduce its statistical weight because such ratings may be more volatile or easier to manipulate.",
        "When QNext exceeds 100 internal ratings for a movie or series, the general rating prioritizes QNext’s own community average.",
        "While QNext has fewer than 100 internal ratings, the general rating may combine IMDb and QNext ratings, initially giving greater weight to IMDb.",
        "User ratings may be visible according to the user’s privacy settings, followers, and friends.",
        "QNext may adjust its ranking, recommendation, or weighting formulas to improve accuracy, safety, and user experience.",
      ],
    },
    {
      subtitle: "3. Basic Profile Privacy",
      paragraphs: [
        "When creating an account, the user acknowledges that their profile is initially created as public.",
        "Visible personal data and public activity may be displayed according to the user’s active settings.",
        "The user may change their profile to private at any time from “Privacy & Security”.",
        "The visibility of ratings, comments, recommendations, and personal data depends on the profile configuration and permissions defined by the user.",
      ],
    },
    {
      subtitle: "4. Conduct and Content",
      paragraphs: [
        "Users are responsible for their comments, ratings, recommendations, messages, and any other content they publish.",
        "Offensive, illegal, discriminatory, threatening, fraudulent, defamatory content, content that infringes third-party rights, or content that exposes another person’s private information is not allowed.",
        "QNext may moderate, limit, hide, suspend, or remove content or accounts that violate these policies or affect community safety.",
      ],
    },
    {
      subtitle: "5. Accuracy of External Data",
      paragraphs: [
        "QNext does not guarantee the absolute accuracy, permanent availability, or immediate updating of information from IMDb, TMDB, or other external sources.",
        "Titles, synopses, posters, directors, cast, genres, years, votes, and external ratings may contain errors, changes, or differences from their original sources.",
        "QNext may correct, update, hide, or adjust information when necessary.",
      ],
    },
    {
      subtitle: "6. Content and Account Removal",
      paragraphs: [
        "QNext may remove content that infringes third-party rights, privacy, security, intellectual property, or community rules.",
        "Users may request deletion or modification of personal information when legally applicable.",
        "Some interactions may be retained in aggregated, anonymized, or pseudonymized form for security, audit, statistics, or technical operation.",
      ],
    },
    {
      subtitle: "7. Personal Data Processing",
      paragraphs: [
        "In Colombia, QNext applies Law 1581 of 2012 as the framework for personal data protection.",
        "Summary of Article 8 of Law 1581 of 2012: the data subject has the right to know, update, and rectify their data, request proof of authorization, be informed about the use of their data, file complaints, and revoke authorization or request deletion when applicable.",
        "Summary of Article 9 of Law 1581 of 2012: data processing requires prior, express, and informed authorization from the data subject, except for legal exceptions.",
        "Summary of Articles 17 and 18 of Law 1581 of 2012: the controller and processor must protect security and confidentiality, properly preserve information, and respond to inquiries and claims.",
        "In the United States, QNext will observe applicable privacy regulations when appropriate, including CCPA/CPRA for California residents when applicable.",
        "General rights include knowing, updating, rectifying, requesting deletion, limiting processing, and consulting the use of personal data when legally applicable.",
        "Processing purposes include authentication, platform operation, recommendation personalization, social interaction, security, abuse prevention, support, analytics, service improvement, and account-related communications.",
        "QNext may use aggregated, anonymized, or pseudonymized information for statistical, analytical, academic, service improvement, recommendation-system training, and user-experience optimization purposes, without individually identifying users or compromising sensitive personal information.",
        "QNext is intended only for users over 13 years of age.",
      ],
    },
    {
      subtitle: "8. QNext Intellectual Property",
      paragraphs: [
        "QNext retains rights over its brand, name, logo, visual identity, interface design, user experience, navigation structure, proprietary texts, visual components, information organization, presentation logic, rankings, recommendation systems, combinations, curation, data compilations, source code, technical architecture, and proprietary functionalities.",
        "Copying, reproducing, distributing, modifying, mass extracting, scraping, reverse engineering, plagiarizing, cloning the design, reusing distinctive elements, or commercially using QNext elements without authorization is prohibited.",
        "External data from IMDb and TMDB belongs to their respective owners.",
        "User-generated content belongs to or remains under the responsibility of the user who publishes it; by publishing it, the user grants QNext a non-exclusive license to display, store, process, and distribute it within the platform.",
        "QNext may remove content that infringes intellectual property, privacy, security, community rules, or third-party rights.",
        "QNext does not authorize the use of its brand or visual elements to create confusingly similar or competing products.",
      ],
    },
    {
      subtitle: "9. Credits and External Sources",
      paragraphs: [
        "This product uses the TMDB API but is not endorsed or certified by TMDB.",
        "Posters and synopses used in QNext come from TMDB.",
        "Part of the movie and series information used in QNext, including titles, years, type, directors, cast, genres, vote counts, and reference average ratings, comes from IMDb.",
        "QNext is an independent platform and is not officially affiliated with, endorsed, certified, or sponsored by IMDb or TMDB.",
        "IMDb and TMDB retain all rights over their respective databases, brands, assets, and content.",
      ],
      showTmdbAttribution: true,
    },
  ],
};
