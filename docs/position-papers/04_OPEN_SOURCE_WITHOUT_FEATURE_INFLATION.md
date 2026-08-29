# Open Source Without Feature Inflation

## Product governance and commercialization for SHITLIST

---

## Executive summary

Open-source work-management software faces a predictable failure mode.

The project gains users.

Different teams request different workflow features.

Every request sounds individually reasonable.

The product slowly becomes the thing it was created to replace.

SHITLIST therefore needs not only technical governance, but product governance.

This paper defines a model for keeping the open-source core useful, the hosted business viable, and the product philosophy intact.

---

# 1. The open-source promise

The Community edition should be a real product.

It should include the capabilities necessary for a small team to run SHITLIST indefinitely:

- unlimited users,
- teams,
- shared queue,
- task CRUD,
- semantic task actions,
- blockers,
- task history,
- API,
- self-hosting,
- backup/export capability,
- webhooks/integration primitives.

Open source should not be a demo funnel.

The value proposition is weakened if basic teamwork is artificially locked behind a paid tier.

---

# 2. What the hosted product sells

The hosted product should sell convenience.

Examples:

- managed infrastructure,
- backups,
- upgrades,
- monitoring,
- hosted email,
- notifications,
- OAuth,
- attachment storage,
- managed integrations,
- import assistance.

The customer pays because they do not want to operate the software.

That is a clean transaction.

---

# 3. What enterprise can sell later

Enterprise features should be tied to actual enterprise requirements:

- SAML / SSO,
- SCIM,
- organization-level access policy,
- configurable retention,
- advanced audit export,
- managed on-prem deployment,
- support agreements,
- procurement/security documentation.

The enterprise tier should not be the place where ordinary product usability goes to die.

---

# 4. The feature inflation problem

Suppose ten users request epics, sprints, due dates, labels, custom workflows, time tracking, Gantt charts, roadmaps, OKRs, and dependency graphs.

Each request is plausible.

Together, they recreate an enterprise project-management suite.

Therefore feature evaluation must include not only:

> Would someone use this?

but:

> Does this preserve the product's ability to answer the five questions faster?

Those questions are:

1. what matters,
2. who owns it,
3. what is blocked,
4. what is unowned,
5. what changed.

---

# 5. Feature admission test

A proposed core feature should pass most of these:

## 5.1 Does it improve operational clarity?

Can the team understand current work better?

## 5.2 Does it reduce coordination cost?

Does it eliminate repeated explanation or manual chasing?

## 5.3 Is the concept broadly useful?

Or is it specific to one organization's process?

## 5.4 Can it remain optional?

Will teams who do not use it continue seeing a simple product?

## 5.5 Does it preserve the queue?

Does the ordered queue remain the primary experience?

## 5.6 Can it be removed conceptually?

If the feature became mandatory, would SHITLIST still feel like SHITLIST?

If not, be cautious.

---

# 6. Extensions before core expansion

Where possible, specialized behavior should live in integrations or extensions before entering the canonical task model.

Examples:

- GitHub-specific automation,
- Slack notifications,
- external reporting,
- organization-specific metadata,
- custom analytics.

This creates an important separation:

```text
CORE = shared coordination model
EXTENSIONS = local workflow preference
```

---

# 7. API as an escape valve

A strong API reduces pressure to make every workflow native.

Teams should be able to automate around SHITLIST without requiring SHITLIST itself to absorb every process.

Useful primitives include:

```text
GET team tasks
POST task
PATCH task
TAKE
START
BLOCK
REVIEW
DONE
GET task history
GET team pulse
webhooks
```

A boring API is a strategic feature.

---

# 8. Governance of the roadmap

The public roadmap should separate:

```text
PROVEN NEED
EXPERIMENT
REQUESTED
REJECTED / NOT CORE
```

Rejecting features publicly can be healthy.

For example:

```text
Story points
Status: NOT CORE
Reason: effort-estimation methodology should not be required by the product.
```

This demonstrates that product restraint is intentional rather than incomplete.

---

# 9. Licensing

The final license choice should match the project's commercial goals.

The decision deserves explicit consideration of community adoption, hosted competitors, contribution expectations, commercial embedding, trademark control, and long-term governance.

The product should not casually choose a license because it is common.

License is strategy.

No specific license recommendation is asserted in this paper because that choice should be made deliberately with legal input.

---

# 10. Brand and product discipline

SHITLIST's irreverent brand can attract attention.

The product itself still needs to earn trust.

That means stable upgrades, predictable migrations, documented backups, clear security boundaries, accessible API behavior, and restrained defaults.

The jokes can swear.

The database should not.

---

# 11. The commercial test

A healthy model should allow this statement to remain true:

> A broke five-person team can self-host SHITLIST forever without being punished for not paying.

And this statement should also be true:

> A funded company can happily pay SHITLIST because operating software is not the thing they want to spend time on.

If both are true, the incentives are aligned.

---

# Conclusion

The biggest threat to SHITLIST is not Jira.

It is becoming Jira.

Open-source governance must protect the product's defining constraint:

> Team coordination should stay smaller than the work being coordinated.

The project should grow.

The bureaucracy should not.
