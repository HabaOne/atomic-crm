from investor_mapping import normalize_sectors, normalize_stages, primary_person_ids


def test_sector_synonyms_collapse_to_one_value():
    assert normalize_sectors(["AI", "Artificial Intelligence", "AI/ML"]) == ["AI"]
    assert normalize_sectors(["Fintech", "FinTech", "fintech"]) == ["Fintech"]


def test_one_label_can_map_to_several_sectors():
    assert normalize_sectors(["AI Infrastructure"]) == ["AI", "Infrastructure"]


def test_generic_labels_stay_unmapped():
    assert normalize_sectors(["Technology", "Venture Capital"]) == []
    assert normalize_sectors([]) == []
    assert normalize_sectors(None) == []


def test_output_follows_target_list_order():
    assert normalize_sectors(["Gaming", "Biotech", "Crypto"]) == [
        "Bio/Life Sciences",
        "Crypto/Web3",
        "Media/Gaming",
    ]


def test_stages_drop_unknown_and_keep_funnel_order():
    assert normalize_stages(["series_a", "seed", "seed", "mezzanine"]) == ["seed", "series_a"]
    assert normalize_stages(None) == []


def _person(pid, company, seniority, title="", email=None, linkedin=None, last="x"):
    return {
        "person_id": pid,
        "company_id": company,
        "seniority": seniority,
        "title": title,
        "email": email,
        "linkedin_url": linkedin,
        "last_name": last,
        "first_name": "",
    }


def test_primary_contact_prefers_seniority_then_lead_title_then_email():
    people = [
        _person("p1", "c1", "principal", email="a@x.com"),
        _person("p2", "c1", "partner", "Partner"),
        _person("p3", "c1", "partner", "Managing Partner"),
        _person("p4", "c2", "partner", "Partner"),
        _person("p5", "c2", "partner", "Partner", email="b@x.com"),
        _person("p6", "c3", "founder"),
        _person("p7", "c3", "partner"),
    ]
    assert primary_person_ids(people) == {"p3", "p5", "p7"}


def test_exactly_one_primary_per_company():
    people = [_person(f"p{i}", f"c{i % 3}", "investor", last=str(i)) for i in range(9)]
    assert len(primary_person_ids(people)) == 3
