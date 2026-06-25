# Golden Set — Suspect Label Review
Generated from 3 independent tagger runs (v2.1, v2.2@0.3, v2.2@0.1). A golden
`expected` tag that **no** run ever produced is likely a mislabel. Review each:
mark the suspect tag **KEEP** (tagger is wrong) or **DROP/FIX** (label is wrong).

**30/60 posts flagged.** Most-suspect tags: `red_pill_pipeline`×8, `firehose_falsehood`×4, `false_equivalence`×3, `coordinated_inauthentic`×2, `appeal_to_victimhood`×2, `election_integrity`×2, `political_disinfo`×2, `polarised`×2, `coordinated_amplified`×2, `counter_narrative_forming`×2, `health_misinfo`×1, `identity_wedge`×1, `unified_amplification`×1

> Tip: start with the `red_pill_pipeline` block — it's the single biggest source of disagreement.

---
### g38  — suspect: `coordinated_inauthentic`, `red_pill_pipeline`
- expected: ['coordinated_inauthentic', 'election_integrity', 'red_pill_pipeline']  | taggers consistently said: ['anti_institution', 'election_integrity', 'firehose_falsehood']
- text: "Every election year the same pattern: 6 months before voting, 'independent' polls show the establishment candidate surging. Same pollster, same methodology, same media outlets. It's predictive programming, not polling."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g47  — suspect: `false_equivalence`, `health_misinfo`
- expected: ['false_equivalence', 'firehose_falsehood', 'health_misinfo']  | taggers consistently said: ['anti_institution', 'firehose_falsehood', 'political_disinfo', 'red_pill_pipeline']
- text: "The drought in Northern Kenya isn't natural — it's climate engineering. HAARP installations in the Indian Ocean are redirecting rainfall. That's why it's been 4 failed rainy seasons. Wake up."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g12  — suspect: `appeal_to_victimhood`
- expected: ['appeal_to_victimhood']  | taggers consistently said: ['anti_institution', 'political_disinfo']
- text: "These Gen Z protesters don't understand how politics works in this country. They think shouting on Twitter will change anything. Raila tried for 40 years. Nothing changed."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g13  — suspect: `election_integrity`
- expected: ['astroturfing', 'coordinated_inauthentic', 'election_integrity']  | taggers consistently said: ['astroturfing', 'coordinated_inauthentic', 'political_disinfo']
- text: "All these accounts tweeting #RutoMustGo are bots. Look at the creation dates — all June 2024. Same script, same hashtags, same posting times. Coordinated by a foreign PR firm."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g15  — suspect: `red_pill_pipeline`
- expected: ['false_equivalence', 'red_pill_pipeline']  | taggers consistently said: ['anti_institution', 'false_equivalence', 'political_disinfo']
- text: "You guys are all falling for the same trap again. Both sides are playing you. Ruto and Raila are cousins who went to the same school. The beef is staged. Wake up."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g19  — suspect: `firehose_falsehood`
- expected: ['anti_institution', 'firehose_falsehood', 'political_disinfo']  | taggers consistently said: ['anti_institution', 'political_disinfo']
- text: "Kenyan police killed 47 protesters in June alone. The real number is higher because they're burying bodies in mass graves in Aberdare forest. I have coordinates."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g2  — suspect: `political_disinfo`
- expected: ['economic_fear', 'political_disinfo']  | taggers consistently said: ['anti_institution', 'appeal_to_victimhood', 'economic_fear']
- text: "The finance bill is a trap. They're selling our country to the IMF and calling it 'development'. Every shilling of debt your grandchildren will pay."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g22  — suspect: `firehose_falsehood`
- expected: ['firehose_falsehood', 'identity_wedge']  | taggers consistently said: ['appeal_to_victimhood', 'identity_wedge', 'political_disinfo']
- text: "KALENJIN COMMUNITY ALERT: Kikuyu business owners in Eldoret are being targeted. We have names and locations of the perpetrators. This is ethnic cleansing starting again."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g23  — suspect: `polarised`
- expected: ['anti_institution', 'polarised']  | taggers consistently said: ['anti_institution', 'appeal_to_victimhood']
- text: "For years people said 'the courts are captured' and everyone called them conspiracy theorists. Today the Supreme Court literally ruled that the president can ignore court orders. Who's the conspiracy theorist now?"
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g25  — suspect: `red_pill_pipeline`
- expected: ['astroturfing', 'coordinated_inauthentic', 'red_pill_pipeline']  | taggers consistently said: ['anti_institution', 'astroturfing', 'coordinated_amplified', 'coordinated_inauthentic']
- text: "Notice how the same 5 Twitter accounts dominate every #KOT trending topic? Thread: here are the actual humans behind the bot networks. LinkedIn profiles, real names, political connections. 1/30"
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g26  — suspect: `red_pill_pipeline`
- expected: ['anti_institution', 'red_pill_pipeline']  | taggers consistently said: ['anti_institution', 'media_crossover']
- text: "The media blackout on the teachers' strike is intentional. 340,000 teachers have been on strike for 3 weeks and not a single headline on Citizen or NTV. Ask yourself who owns those stations."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g28  — suspect: `red_pill_pipeline`
- expected: ['anti_institution', 'red_pill_pipeline']  | taggers consistently said: ['anti_institution', 'appeal_to_victimhood', 'political_disinfo']
- text: "The Kenyan education system is designed to produce obedient workers, not thinkers. That's why they removed critical thinking from the 8-4-4 syllabus. The CBC is just repackaged colonial education."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g29  — suspect: `firehose_falsehood`
- expected: ['election_integrity', 'firehose_falsehood', 'political_disinfo']  | taggers consistently said: ['election_integrity', 'political_disinfo']
- text: "ALERT: Voter registration numbers in Mt Kenya region have been artificially inflated by 1.2 million. Here are the IEBC register snapshots from February vs June. The math doesn't add up. SHARE WIDELY."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g3  — suspect: `election_integrity`
- expected: ['election_integrity', 'firehose_falsehood', 'identity_wedge']  | taggers consistently said: ['appeal_to_victimhood', 'firehose_falsehood', 'identity_wedge', 'political_disinfo']
- text: "LUO COMMUNITY WARNED: Ruto's government planning mass displacement in Kisumu. Share before they take it down. This is 2007 all over again."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g30  — suspect: `red_pill_pipeline`
- expected: ['anti_institution', 'economic_fear', 'red_pill_pipeline']  | taggers consistently said: ['anti_institution', 'economic_fear', 'firehose_falsehood', 'political_disinfo']
- text: "The World Economic Forum's 'Great Reset' agenda is being implemented in Kenya through the affordable housing levy. It's not about houses — it's about centralizing control over where and how Kenyans live."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g34  — suspect: `coordinated_amplified`
- expected: ['astroturfing', 'coordinated_amplified']  | taggers consistently said: ['anti_institution', 'astroturfing', 'coordinated_inauthentic']
- text: "This TikTok video of a Kenyan cop returning a lost wallet with all the money intact has 2M views. Every comment: 'See? Not all cops.' This is classic astroturfing. The account was created 4 days ago."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g35  — suspect: `appeal_to_victimhood`
- expected: ['appeal_to_victimhood']  | taggers consistently said: ['anti_institution', 'economic_fear']
- text: "I've lived in Nairobi for 30 years. The security situation has NEVER been this bad. Kidnappings, carjackings, break-ins — and the police do nothing. We're on our own."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g39  — suspect: `false_equivalence`
- expected: ['false_equivalence', 'health_misinfo']  | taggers consistently said: ['anti_institution', 'health_misinfo', 'political_disinfo']
- text: "Fluoride in Nairobi water is making people docile and compliant. Compare crime rates before and after the water treatment plants were upgraded in 2019. The data is undeniable."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g4  — suspect: `firehose_falsehood`
- expected: ['anti_institution', 'economic_fear', 'firehose_falsehood']  | taggers consistently said: ['anti_institution', 'economic_fear', 'political_disinfo', 'red_pill_pipeline']
- text: "Mombasa port has been secretly leased to China for 99 years. The documents are circulating on WhatsApp. Kenyans need to wake up before there's nothing left."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g40  — suspect: `counter_narrative_forming`
- expected: ['counter_narrative_forming']  | taggers consistently said: ['economic_fear', 'political_disinfo']
- text: "Counterpoint to the IMF narrative: Ghana defaulted, Zambia defaulted, Ethiopia is restructuring. Kenya's debt-to-GDP is actually lower than all three. The 'imminent collapse' framing is political, not economic."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g44  — suspect: `political_disinfo`
- expected: ['coordinated_inauthentic', 'election_integrity', 'political_disinfo']  | taggers consistently said: ['coordinated_amplified', 'coordinated_inauthentic', 'election_integrity']
- text: "Kenya's 2027 election will be decided by WhatsApp, not by rallies. The Kikuyu radio stations are already running coordinated messaging. I've mapped the network: 47 group admins, identical script, 900K+ reach."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g46  — suspect: `identity_wedge`
- expected: ['identity_wedge', 'political_disinfo']  | taggers consistently said: ['anti_institution', 'appeal_to_victimhood', 'false_equivalence', 'political_disinfo']
- text: "Somaliland deserves recognition. 30 years of stable democracy while Mogadishu can't hold a village election. The AU silence is political cowardice."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g48  — suspect: `red_pill_pipeline`
- expected: ['anti_institution', 'red_pill_pipeline']  | taggers consistently said: ['anti_institution', 'appeal_to_victimhood', 'identity_wedge']
- text: "My neighbor's teenage son got recruited into a cult disguised as a 'youth mentorship program' in Mathare. They isolate them from families, take their phones, teach them the government is the enemy. This is happening everywhere."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g49  — suspect: `counter_narrative_forming`
- expected: ['counter_narrative_forming']  | taggers consistently said: ['economic_fear', 'political_disinfo']
- text: "Thread: Deconstructing the 'Kenya is the next Sri Lanka' narrative. Actual budget data shows recurrent expenditure has DECREASED as a % of GDP for 3 consecutive years. The development budget increased. This isn't a crisis — it's a smear. 1/12"
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g54  — suspect: `polarised`
- expected: ['anti_institution', 'polarised']  | taggers consistently said: ['anti_institution', 'appeal_to_victimhood', 'political_disinfo']
- text: "Religious leaders endorsing politicians from the pulpit — this is why Kenya is broken. The church has become a campaign platform. Sunday sermons are now political rallies with Bibles. Tax the churches."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g57  — suspect: `coordinated_inauthentic`
- expected: ['astroturfing', 'coordinated_inauthentic', 'political_disinfo']  | taggers consistently said: ['astroturfing', 'political_disinfo']
- text: "WATCH: This video of Raila's motorcade being stoned in Kisii is going viral. But here's what they're not showing you — the crowd was paid KSh 500 each by a local MP candidate. Same faces appear at 3 different 'spontaneous' protests this month. Video evidence attached."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g58  — suspect: `red_pill_pipeline`
- expected: ['anti_institution', 'economic_fear', 'identity_wedge', 'red_pill_pipeline']  | taggers consistently said: ['anti_institution', 'appeal_to_victimhood', 'economic_fear', 'identity_wedge']
- text: "The Mount Kenya mafia runs this country. Since 1963, every major economic policy has benefited the same 12 families. The names haven't changed in 60 years. Independence was just a management transition."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g60  — suspect: `unified_amplification`
- expected: ['unified_amplification']  | taggers consistently said: ['anti_institution', 'appeal_to_victimhood', 'identity_wedge']
- text: "UNITED front against police brutality. We need ONE voice. Stop arguing about tribe and focus on the real enemy — a system that kills its own citizens with impunity. #SabaSaba"
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g8  — suspect: `coordinated_amplified`
- expected: ['anti_institution', 'coordinated_amplified']  | taggers consistently said: ['anti_institution', 'appeal_to_victimhood']
- text: "RT if you agree that the Kenyan judiciary is completely captured. They don't even pretend anymore. The Supreme Court ruling today proves it."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

### g9  — suspect: `false_equivalence`
- expected: ['false_equivalence', 'health_misinfo']  | taggers consistently said: ['anti_institution', 'health_misinfo']
- text: "5G towers in Karen are causing the mysterious illnesses affecting cattle. Multiple farmers have reported the same pattern — cattle falling sick within weeks of tower installation."
- [ ] verdict: ____________  (KEEP label / DROP suspect tag / FIX to: ____)

