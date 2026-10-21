"""Normalization rules for the investor import v1.0 (2026-10-21).

Pure functions only, so they can be tested without a database.
"""

import re

# Target list, in display order. Keep in sync with the brief.
SECTORS = [
    "AI",
    "Fintech",
    "Health",
    "Bio/Life Sciences",
    "Climate/Energy",
    "Deep Tech",
    "Robotics",
    "Cybersecurity",
    "Enterprise/SaaS",
    "Infrastructure",
    "Crypto/Web3",
    "Space/Defense",
    "Mobility/Logistics",
    "PropTech",
    "Industrial",
    "Consumer",
    "Edtech",
    "Media/Gaming",
    "Food/Agri",
]

# First match per rule wins for that sector; one raw value may map to several
# sectors (for example "AI Infrastructure" -> AI and Infrastructure).
_SECTOR_RULES = [
    ("AI", r"\bai\b|artificial intelligence|machine learning|\bml\b|\bllm|generative|genai|computer vision|\bnlp\b|applied intelligence|world intelligence"),
    ("Fintech", r"fin ?tech|financial|payments?\b|banking|insur|wealth|lending|capital markets|accounting|\bregtech|\bfinance\b|embedded finance"),
    ("Health", r"health|medical|medtech|med tech|digital health|care\b|wellness|clinic|hospital|mental|fertility|fem ?tech|longevity|women.s health"),
    ("Bio/Life Sciences", r"\bbio|life ?sciences?|therapeutic|pharma|drug|genomic|diagnostic|biolog|oncology|gene therap|orphan disease|rare disease"),
    ("Climate/Energy", r"climate|energy|sustainab|clean ?tech|carbon|renewable|solar|battery|batteries|decarbon|green|circular|nuclear|fusion"),
    ("Deep Tech", r"deep ?tech|quantum|semiconductor|photonic|frontier tech|hard ?tech|materials?\b|materials science|nanotech|physics|emerging tech|frontier|\bcomputing\b"),
    ("Robotics", r"robot|automation|autonomous|physical ai|drones?\b|autonomy"),
    ("Cybersecurity", r"cyber|security|identity|privacy|fraud|compliance"),
    ("Enterprise/SaaS", r"saas|enterprise|b2b|software|developer|devtools|future of work|productivity|vertical ai|\bhr\b|hr ?tech|legal ?tech|sales ?tech|martech|collaboration|\bsmb\b|business services|\bwork\b|digiti[sz]ation|\bit\b|internet|open source|applications"),
    ("Infrastructure", r"infrastructure|cloud|data\b|databases?|devops|compute|networking|hardware|\biot\b|telecom|connectivity"),
    ("Crypto/Web3", r"crypto|blockchain|web ?3|defi|digital assets?|\bnft|bitcoin|ethereum|tokeni"),
    ("Space/Defense", r"space|defen[cs]e|aerospace|national security|dual[- ]use|govtech|gov tech|public sector"),
    ("Mobility/Logistics", r"mobility|logistic|transport|supply chain|automotive|\bev\b|electric vehicle|shipping|freight|aviation|maritime|distribution"),
    ("PropTech", r"prop ?tech|real estate|construction|built environment|housing|contech"),
    ("Industrial", r"industr|manufactur|industry 4|chemical|mining|\bindustrials?\b|engineering|critical minerals"),
    ("Consumer", r"consumer|commerce|retail|marketplace|\bd2c\b|\bdtc\b|brands?\b|e-commerce|fashion|beauty|travel|hospitality|social|lifestyle|pets?\b|\bcpg\b|leisure"),
    ("Edtech", r"ed ?tech|education|learning|edu\b"),
    ("Media/Gaming", r"media|gaming|games?\b|entertainment|content|creator|music|sports?\b|esports|video|ad ?tech|advertising"),
    ("Food/Agri", r"food|agri|agtech|ag tech|farm|beverage|nutrition|alt protein"),
]
_COMPILED = [(name, re.compile(pattern, re.IGNORECASE)) for name, pattern in _SECTOR_RULES]


def normalize_sectors(raw_values):
    """Map free-text sector labels to the fixed SECTORS list, in list order."""
    found = set()
    for raw in raw_values or []:
        text = (raw or "").strip()
        if not text:
            continue
        for name, pattern in _COMPILED:
            if pattern.search(text):
                found.add(name)
    return [name for name in SECTORS if name in found]


STAGES = ["pre_seed", "seed", "series_a", "series_b", "growth", "late"]


def normalize_stages(raw_values):
    """Keep known stage keys, deduplicated, in funnel order."""
    keep = {value for value in raw_values or [] if value in STAGES}
    return [stage for stage in STAGES if stage in keep]


_SENIORITY_RANK = {"partner": 0, "founder": 1, "principal": 2, "director": 3, "investor": 4}
_LEAD_TITLE = re.compile(r"managing|general partner|founding|\bgp\b|\bmp\b", re.IGNORECASE)


def primary_sort_key(person):
    """Lower sorts first: seniority, lead title, has email, has LinkedIn, name."""
    title = person.get("title") or ""
    return (
        _SENIORITY_RANK.get(person.get("seniority"), 9),
        0 if _LEAD_TITLE.search(title) else 1,
        0 if person.get("email") else 1,
        0 if person.get("linkedin_url") else 1,
        (person.get("last_name") or "").lower(),
        (person.get("first_name") or "").lower(),
        person.get("person_id") or "",
    )


def primary_person_ids(people):
    """Return the person_id of the top-ranked person per company_id."""
    best = {}
    for person in people:
        company_id = person.get("company_id")
        current = best.get(company_id)
        if current is None or primary_sort_key(person) < primary_sort_key(current):
            best[company_id] = person
    return {person["person_id"] for person in best.values()}
