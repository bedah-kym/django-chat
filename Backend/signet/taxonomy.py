"""Tag taxonomy v1.0 — 4 families, 21 tags total."""

MANIPULATION_TECHNIQUE = [
    'red_pill_pipeline',
    'firehose_falsehood',
    'appeal_to_victimhood',
    'false_equivalence',
    'astroturfing',
    'coordinated_inauthentic',
]

CONTENT_DOMAIN = [
    'political_disinfo',
    'health_misinfo',
    'economic_fear',
    'identity_wedge',
    'election_integrity',
    'anti_institution',
]

SPREAD_PATTERN = [
    'organic_viral',
    'coordinated_amplified',
    'celebrity_laundered',
    'media_crossover',
]

AUDIENCE_RESPONSE = [
    'polarised',
    'unified_amplification',
    'counter_narrative_forming',
    'ignored',
    'mockery',
]

ALL_TAGS = (
    MANIPULATION_TECHNIQUE
    + CONTENT_DOMAIN
    + SPREAD_PATTERN
    + AUDIENCE_RESPONSE
)

TAG_FAMILIES = {
    'manipulation_technique': MANIPULATION_TECHNIQUE,
    'content_domain': CONTENT_DOMAIN,
    'spread_pattern': SPREAD_PATTERN,
    'audience_response': AUDIENCE_RESPONSE,
}

ALLOWED_TAGS = set(ALL_TAGS)

GROUNDING_THRESHOLD = 0.70
HIGH_CONFIDENCE = 0.80
MEDIUM_CONFIDENCE_LOW = 0.50
