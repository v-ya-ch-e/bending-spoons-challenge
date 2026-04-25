{
  "run_id": 5,
  "use_case": "project_rebalance",
  "status": "completed",
  "target_project_id": 2,
  "candidate_count": 25,
  "recommendation_count": 2,
  "hiring_recommendation_count": 0,
  "selected_candidate_plan_id": "plan_01",
  "summary": "Generated 25 strict-rule candidate plans; OpenAI selected plan_01 and returned 2 ranked recommendations with 0 hiring recommendations.",
  "candidates": [
    {
      "candidate_plan_id": "plan_01",
      "strict_score": 0.871,
      "summary": "Move 13, 17, 20 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
      "moves": [
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 17,
          "from_project_id": 3,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Data Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 20,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Product Designer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web gaps."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits.",
        "WeTransfer loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 13, 17, 20 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
        "moves": [
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 17,
            "from_project_id": 3,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Data Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 20,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Product Designer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web gaps."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits.",
          "WeTransfer loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 2,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "3": {
            "headcount_gap": 2,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 1,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 1,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 1
            },
            "coverage_ratio": 0.7722
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_02",
      "strict_score": 0.871,
      "summary": "Move 13, 17, 21 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
      "moves": [
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 17,
          "from_project_id": 3,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Data Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 21,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee helps close the target headcount gap."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits.",
        "WeTransfer loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 13, 17, 21 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
        "moves": [
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 17,
            "from_project_id": 3,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Data Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 21,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee helps close the target headcount gap."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits.",
          "WeTransfer loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 2,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "3": {
            "headcount_gap": 2,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 1,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 1,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 1
            },
            "coverage_ratio": 0.7722
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_03",
      "strict_score": 0.8667,
      "summary": "Move 2, 4, 20 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
      "moves": [
        {
          "employee_id": 2,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 4,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Android Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 20,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Product Designer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web gaps."
        }
      ],
      "risks": [],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 2, 4, 20 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
        "moves": [
          {
            "employee_id": 2,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 4,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Android Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 20,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Product Designer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web gaps."
          }
        ],
        "risks": [],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_04",
      "strict_score": 0.8667,
      "summary": "Move 2, 4, 21 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
      "moves": [
        {
          "employee_id": 2,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 4,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Android Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 21,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee helps close the target headcount gap."
        }
      ],
      "risks": [],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 2, 4, 21 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
        "moves": [
          {
            "employee_id": 2,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 4,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Android Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 21,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee helps close the target headcount gap."
          }
        ],
        "risks": [],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_05",
      "strict_score": 0.8667,
      "summary": "Move 2, 16, 20 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
      "moves": [
        {
          "employee_id": 2,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 16,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Android Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 20,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Product Designer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web gaps."
        }
      ],
      "risks": [],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 2, 16, 20 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
        "moves": [
          {
            "employee_id": 2,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 16,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Android Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 20,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Product Designer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web gaps."
          }
        ],
        "risks": [],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_06",
      "strict_score": 0.8667,
      "summary": "Move 2, 16, 21 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
      "moves": [
        {
          "employee_id": 2,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 16,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Android Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 21,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee helps close the target headcount gap."
        }
      ],
      "risks": [],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 2, 16, 21 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
        "moves": [
          {
            "employee_id": 2,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 16,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Android Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 21,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee helps close the target headcount gap."
          }
        ],
        "risks": [],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_07",
      "strict_score": 0.8667,
      "summary": "Move 10, 4, 20 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
      "moves": [
        {
          "employee_id": 10,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Platform Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 4,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Android Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 20,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Product Designer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web gaps."
        }
      ],
      "risks": [],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 10, 4, 20 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
        "moves": [
          {
            "employee_id": 10,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Platform Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 4,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Android Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 20,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Product Designer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web gaps."
          }
        ],
        "risks": [],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_08",
      "strict_score": 0.8667,
      "summary": "Move 10, 4, 21 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
      "moves": [
        {
          "employee_id": 10,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Platform Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 4,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Android Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 21,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee helps close the target headcount gap."
        }
      ],
      "risks": [],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 10, 4, 21 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
        "moves": [
          {
            "employee_id": 10,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Platform Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 4,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Android Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 21,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee helps close the target headcount gap."
          }
        ],
        "risks": [],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_09",
      "strict_score": 0.8667,
      "summary": "Move 10, 16, 20 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
      "moves": [
        {
          "employee_id": 10,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Platform Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 16,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Android Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 20,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Product Designer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web gaps."
        }
      ],
      "risks": [],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 10, 16, 20 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
        "moves": [
          {
            "employee_id": 10,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Platform Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 16,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Android Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 20,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Product Designer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web gaps."
          }
        ],
        "risks": [],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_10",
      "strict_score": 0.8667,
      "summary": "Move 10, 16, 21 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
      "moves": [
        {
          "employee_id": 10,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Platform Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 16,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Android Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 21,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee helps close the target headcount gap."
        }
      ],
      "risks": [],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 10, 16, 21 toward Remini to reduce headcount or skill gaps with strict score 0.87.",
        "moves": [
          {
            "employee_id": 10,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Platform Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 16,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Android Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 21,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee helps close the target headcount gap."
          }
        ],
        "risks": [],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_11",
      "strict_score": 0.864,
      "summary": "Move 11, 13, 17 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 11,
          "from_project_id": 4,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Full-stack Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 17,
          "from_project_id": 3,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Data Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target web, backend gaps."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits.",
        "WeTransfer loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 11, 13, 17 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 11,
            "from_project_id": 4,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Full-stack Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 17,
            "from_project_id": 3,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Data Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target web, backend gaps."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits.",
          "WeTransfer loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 2,
              "ios": 3,
              "web": 3,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "3": {
            "headcount_gap": 2,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 1,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 1,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 1
            },
            "coverage_ratio": 0.7722
          },
          "4": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 2,
              "web": 3,
              "backend": 2,
              "infrastructure": 1,
              "ai": 1
            },
            "coverage_ratio": 1
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_12",
      "strict_score": 0.8631,
      "summary": "Move 16, 17, 20 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 16,
          "from_project_id": 4,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Android Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 17,
          "from_project_id": 3,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Data Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 20,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Product Designer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web gaps."
        }
      ],
      "risks": [
        "Meetup loses useful coverage but remains within strict limits.",
        "WeTransfer loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 16, 17, 20 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 16,
            "from_project_id": 4,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Android Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 17,
            "from_project_id": 3,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Data Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 20,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Product Designer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web gaps."
          }
        ],
        "risks": [
          "Meetup loses useful coverage but remains within strict limits.",
          "WeTransfer loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "3": {
            "headcount_gap": 2,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 1,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 1,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 1
            },
            "coverage_ratio": 0.7722
          },
          "4": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 1,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 2,
              "web": 3,
              "backend": 2,
              "infrastructure": 1,
              "ai": 1
            },
            "coverage_ratio": 0.9583
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_13",
      "strict_score": 0.8619,
      "summary": "Move 13, 6, 17 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 6,
          "from_project_id": 4,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Product Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 17,
          "from_project_id": 3,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Data Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target web, backend gaps."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits.",
        "Meetup loses useful coverage but remains within strict limits.",
        "WeTransfer loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 13, 6, 17 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 6,
            "from_project_id": 4,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Product Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 17,
            "from_project_id": 3,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Data Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target web, backend gaps."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits.",
          "Meetup loses useful coverage but remains within strict limits.",
          "WeTransfer loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 2,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "3": {
            "headcount_gap": 2,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 1,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 1,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 1
            },
            "coverage_ratio": 0.7722
          },
          "4": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 1,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 1,
              "web": 3,
              "backend": 2,
              "infrastructure": 1,
              "ai": 1
            },
            "coverage_ratio": 0.9583
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_14",
      "strict_score": 0.8619,
      "summary": "Move 13, 16, 17 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 16,
          "from_project_id": 4,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Android Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 17,
          "from_project_id": 3,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Data Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target web, backend gaps."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits.",
        "Meetup loses useful coverage but remains within strict limits.",
        "WeTransfer loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 13, 16, 17 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 16,
            "from_project_id": 4,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Android Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 17,
            "from_project_id": 3,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Data Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target web, backend gaps."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits.",
          "Meetup loses useful coverage but remains within strict limits.",
          "WeTransfer loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "3": {
            "headcount_gap": 2,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 1,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 1,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 1
            },
            "coverage_ratio": 0.7722
          },
          "4": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 1,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 2,
              "web": 3,
              "backend": 2,
              "infrastructure": 1,
              "ai": 1
            },
            "coverage_ratio": 0.9583
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_15",
      "strict_score": 0.8604,
      "summary": "Move 2, 16, 20 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 2,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 16,
          "from_project_id": 4,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Android Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 20,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Product Designer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web gaps."
        }
      ],
      "risks": [
        "Meetup loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 2, 16, 20 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 2,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 16,
            "from_project_id": 4,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Android Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 20,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Product Designer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web gaps."
          }
        ],
        "risks": [
          "Meetup loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "4": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 1,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 2,
              "web": 3,
              "backend": 2,
              "infrastructure": 1,
              "ai": 1
            },
            "coverage_ratio": 0.9583
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_16",
      "strict_score": 0.8604,
      "summary": "Move 2, 16, 21 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 2,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 16,
          "from_project_id": 4,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Android Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 21,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee helps close the target headcount gap."
        }
      ],
      "risks": [
        "Meetup loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 2, 16, 21 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 2,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 16,
            "from_project_id": 4,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Android Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 21,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee helps close the target headcount gap."
          }
        ],
        "risks": [
          "Meetup loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "4": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 1,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 2,
              "web": 3,
              "backend": 2,
              "infrastructure": 1,
              "ai": 1
            },
            "coverage_ratio": 0.9583
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_17",
      "strict_score": 0.8604,
      "summary": "Move 10, 16, 20 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 10,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Platform Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 16,
          "from_project_id": 4,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Android Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 20,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Product Designer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web gaps."
        }
      ],
      "risks": [
        "Meetup loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 10, 16, 20 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 10,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Platform Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 16,
            "from_project_id": 4,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Android Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 20,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Product Designer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web gaps."
          }
        ],
        "risks": [
          "Meetup loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "4": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 1,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 2,
              "web": 3,
              "backend": 2,
              "infrastructure": 1,
              "ai": 1
            },
            "coverage_ratio": 0.9583
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_18",
      "strict_score": 0.8604,
      "summary": "Move 10, 16, 21 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 10,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Platform Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 16,
          "from_project_id": 4,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Android Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 21,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee helps close the target headcount gap."
        }
      ],
      "risks": [
        "Meetup loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 10, 16, 21 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 10,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Platform Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 16,
            "from_project_id": 4,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Android Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 21,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee helps close the target headcount gap."
          }
        ],
        "risks": [
          "Meetup loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "4": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 1,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 2,
              "web": 3,
              "backend": 2,
              "infrastructure": 1,
              "ai": 1
            },
            "coverage_ratio": 0.9583
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_19",
      "strict_score": 0.8596,
      "summary": "Move 2, 13, 20 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 2,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 20,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Product Designer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web gaps."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 2, 13, 20 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 2,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 20,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Product Designer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web gaps."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 2,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_20",
      "strict_score": 0.8596,
      "summary": "Move 2, 13, 21 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 2,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 21,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee helps close the target headcount gap."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 2, 13, 21 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 2,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 21,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee helps close the target headcount gap."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 2,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_21",
      "strict_score": 0.8596,
      "summary": "Move 10, 13, 20 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 10,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Platform Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 20,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Product Designer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target android, web gaps."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 10, 13, 20 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 10,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Platform Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 20,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Product Designer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target android, web gaps."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 2,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_22",
      "strict_score": 0.8596,
      "summary": "Move 10, 13, 21 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
      "moves": [
        {
          "employee_id": 10,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Platform Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 21,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "assign",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee helps close the target headcount gap."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 10, 13, 21 toward Remini to reduce headcount or skill gaps with strict score 0.86.",
        "moves": [
          {
            "employee_id": 10,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Platform Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 21,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "assign",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee helps close the target headcount gap."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 2,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_23",
      "strict_score": 0.8548,
      "summary": "Move 2, 11, 13 toward Remini to reduce headcount or skill gaps with strict score 0.85.",
      "moves": [
        {
          "employee_id": 2,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 11,
          "from_project_id": 4,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Full-stack Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 2, 11, 13 toward Remini to reduce headcount or skill gaps with strict score 0.85.",
        "moves": [
          {
            "employee_id": 2,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 11,
            "from_project_id": 4,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Full-stack Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 2,
              "ios": 3,
              "web": 3,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "4": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 2,
              "web": 3,
              "backend": 2,
              "infrastructure": 1,
              "ai": 1
            },
            "coverage_ratio": 1
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_24",
      "strict_score": 0.8548,
      "summary": "Move 10, 11, 13 toward Remini to reduce headcount or skill gaps with strict score 0.85.",
      "moves": [
        {
          "employee_id": 10,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Platform Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 11,
          "from_project_id": 4,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Full-stack Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 10, 11, 13 toward Remini to reduce headcount or skill gaps with strict score 0.85.",
        "moves": [
          {
            "employee_id": 10,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Platform Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 11,
            "from_project_id": 4,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Full-stack Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 2,
              "ios": 3,
              "web": 3,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "4": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 3,
              "ios": 2,
              "web": 3,
              "backend": 2,
              "infrastructure": 1,
              "ai": 1
            },
            "coverage_ratio": 1
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    },
    {
      "candidate_plan_id": "plan_25",
      "strict_score": 0.8544,
      "summary": "Move 2, 13, 17 toward Remini to reduce headcount or skill gaps with strict score 0.85.",
      "moves": [
        {
          "employee_id": 2,
          "from_project_id": null,
          "to_project_id": 2,
          "action": "add_assignment",
          "suggested_role": "Backend Engineer",
          "current_project_impact": "low",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "reason": "Employee covers target web, backend gaps."
        },
        {
          "employee_id": 13,
          "from_project_id": 6,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "QA Automation Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target android, web, backend gaps."
        },
        {
          "employee_id": 17,
          "from_project_id": 3,
          "to_project_id": 2,
          "action": "move",
          "suggested_role": "Data Engineer",
          "current_project_impact": "medium",
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "reason": "Employee covers target web, backend gaps."
        }
      ],
      "risks": [
        "StreamYard loses useful coverage but remains within strict limits.",
        "WeTransfer loses useful coverage but remains within strict limits."
      ],
      "hard_rule_summary": {
        "valid": true,
        "target_project_id": 2,
        "move_count": 3,
        "target_gap_before": 4,
        "target_gap_after": 0,
        "target_coverage_before": 0.6389,
        "target_coverage_after": 1,
        "rules_checked": [
          "identity",
          "skill_contract",
          "headcount",
          "source_project_protection",
          "pending_requests",
          "reasonable_disruption"
        ]
      },
      "plan_payload": {
        "summary": "Move 2, 13, 17 toward Remini to reduce headcount or skill gaps with strict score 0.85.",
        "moves": [
          {
            "employee_id": 2,
            "from_project_id": null,
            "to_project_id": 2,
            "action": "add_assignment",
            "suggested_role": "Backend Engineer",
            "current_project_impact": "low",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "No source project loses current coverage."
            ],
            "reason": "Employee covers target web, backend gaps."
          },
          {
            "employee_id": 13,
            "from_project_id": 6,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "QA Automation Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target android, web, backend gaps."
          },
          {
            "employee_id": 17,
            "from_project_id": 3,
            "to_project_id": 2,
            "action": "move",
            "suggested_role": "Data Engineer",
            "current_project_impact": "medium",
            "hard_rule_reasons": [
              "Employee and target project exist in the DB snapshot.",
              "Move improves or preserves target coverage.",
              "Source project remains above strict minimums."
            ],
            "reason": "Employee covers target web, backend gaps."
          }
        ],
        "risks": [
          "StreamYard loses useful coverage but remains within strict limits.",
          "WeTransfer loses useful coverage but remains within strict limits."
        ],
        "project_coverage_after": {
          "2": {
            "headcount_gap": 0,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 2,
              "ios": 3,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 3
            },
            "coverage_ratio": 1
          },
          "3": {
            "headcount_gap": 2,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 1,
              "backend": 0,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 1,
              "web": 2,
              "backend": 3,
              "infrastructure": 3,
              "ai": 1
            },
            "coverage_ratio": 0.7722
          },
          "6": {
            "headcount_gap": 1,
            "skill_gap": {
              "android": 0,
              "ios": 0,
              "web": 0,
              "backend": 1,
              "infrastructure": 0,
              "ai": 0
            },
            "available_skills": {
              "android": 1,
              "ios": 3,
              "web": 3,
              "backend": 2,
              "infrastructure": 3,
              "ai": 2
            },
            "coverage_ratio": 0.8417
          }
        }
      }
    }
  ],
  "recommendations": [
    {
      "candidate_plan_id": "plan_01",
      "rank": 1,
      "fit_score": 0.86,
      "summary": "Strong skill fit for Remini with full coverage and good preference alignment: Francesca and Giovanni both list Remini among their preferences, and Paolo adds useful product/design support. This plan also keeps ramp-up short while avoiding the need for a zero-skill assignment. The tradeoff is medium disruption to two source projects, but it is still a balanced coverage-first option.",
      "explanation": "Strong skill fit for Remini with full coverage and good preference alignment: Francesca and Giovanni both list Remini among their preferences, and Paolo adds useful product/design support. This plan also keeps ramp-up short while avoiding the need for a zero-skill assignment. The tradeoff is medium disruption to two source projects, but it is still a balanced coverage-first option.",
      "risks": [
        "Medium disruption to StreamYard and WeTransfer.",
        "Coverage is met, but the plan relies on two source-project moves rather than purely additive staffing."
      ],
      "ramp_up_estimate": null,
      "suggested_moves": [
        {
          "action": "move",
          "reason": "Employee covers target android, web, backend gaps.",
          "employee_id": 13,
          "to_project_id": 2,
          "suggested_role": "QA Automation Engineer",
          "from_project_id": 6,
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "move_request_reason": "Strong skill fit for Remini with full coverage and good preference alignment: Francesca and Giovanni both list Remini among their preferences, and Paolo adds useful product/design support. This plan also keeps ramp-up short while avoiding the need for a zero-skill assignment. The tradeoff is medium disruption to two source projects, but it is still a balanced coverage-first option.",
          "current_project_impact": "medium"
        },
        {
          "action": "move",
          "reason": "Employee covers target web, backend gaps.",
          "employee_id": 17,
          "to_project_id": 2,
          "suggested_role": "Data Engineer",
          "from_project_id": 3,
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "Source project remains above strict minimums."
          ],
          "move_request_reason": "Strong skill fit for Remini with full coverage and good preference alignment: Francesca and Giovanni both list Remini among their preferences, and Paolo adds useful product/design support. This plan also keeps ramp-up short while avoiding the need for a zero-skill assignment. The tradeoff is medium disruption to two source projects, but it is still a balanced coverage-first option.",
          "current_project_impact": "medium"
        },
        {
          "action": "assign",
          "reason": "Employee covers target android, web gaps.",
          "employee_id": 20,
          "to_project_id": 2,
          "suggested_role": "Product Designer",
          "from_project_id": null,
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "move_request_reason": "Strong skill fit for Remini with full coverage and good preference alignment: Francesca and Giovanni both list Remini among their preferences, and Paolo adds useful product/design support. This plan also keeps ramp-up short while avoiding the need for a zero-skill assignment. The tradeoff is medium disruption to two source projects, but it is still a balanced coverage-first option.",
          "current_project_impact": "low"
        }
      ],
      "model_metadata": {
        "model": "gpt-5.4-mini",
        "prompt_version": "matching_llm_evaluator_v1"
      }
    },
    {
      "candidate_plan_id": "plan_03",
      "rank": 2,
      "fit_score": 0.82,
      "summary": "Lowest disruption option because it uses only new assignments and no source-project moves. It still fully covers Remini, with strong backend and Android support plus a product designer. The tradeoff is weaker preference alignment than plan_01 and slightly less direct skill match on the backend/infrastructure side.",
      "explanation": "Lowest disruption option because it uses only new assignments and no source-project moves. It still fully covers Remini, with strong backend and Android support plus a product designer. The tradeoff is weaker preference alignment than plan_01 and slightly less direct skill match on the backend/infrastructure side. Tradeoff: Best for minimizing source-project disruption, but with somewhat lower preference alignment and less targeted coverage than the top plan.",
      "risks": [
        "One assigned employee has no listed skills, so ramp-up and role fit are less certain.",
        "Less preference alignment than the move-based option."
      ],
      "ramp_up_estimate": null,
      "suggested_moves": [
        {
          "action": "add_assignment",
          "reason": "Employee covers target web, backend gaps.",
          "employee_id": 2,
          "to_project_id": 2,
          "suggested_role": "Backend Engineer",
          "from_project_id": null,
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "move_request_reason": "Lowest disruption option because it uses only new assignments and no source-project moves. It still fully covers Remini, with strong backend and Android support plus a product designer. The tradeoff is weaker preference alignment than plan_01 and slightly less direct skill match on the backend/infrastructure side.",
          "current_project_impact": "low"
        },
        {
          "action": "add_assignment",
          "reason": "Employee covers target android, web, backend gaps.",
          "employee_id": 4,
          "to_project_id": 2,
          "suggested_role": "Android Engineer",
          "from_project_id": null,
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "move_request_reason": "Lowest disruption option because it uses only new assignments and no source-project moves. It still fully covers Remini, with strong backend and Android support plus a product designer. The tradeoff is weaker preference alignment than plan_01 and slightly less direct skill match on the backend/infrastructure side.",
          "current_project_impact": "low"
        },
        {
          "action": "assign",
          "reason": "Employee covers target android, web gaps.",
          "employee_id": 20,
          "to_project_id": 2,
          "suggested_role": "Product Designer",
          "from_project_id": null,
          "hard_rule_reasons": [
            "Employee and target project exist in the DB snapshot.",
            "Move improves or preserves target coverage.",
            "No source project loses current coverage."
          ],
          "move_request_reason": "Lowest disruption option because it uses only new assignments and no source-project moves. It still fully covers Remini, with strong backend and Android support plus a product designer. The tradeoff is weaker preference alignment than plan_01 and slightly less direct skill match on the backend/infrastructure side.",
          "current_project_impact": "low"
        }
      ],
      "model_metadata": {
        "model": "gpt-5.4-mini",
        "prompt_version": "matching_llm_evaluator_v1"
      }
    }
  ],
  "hiring_recommendations": [],
  "logs": [
    {
      "level": "info",
      "stage": "strict_rules",
      "event_type": "strict_rules.started",
      "message": "Started deterministic strict-rule matching.",
      "metadata": {
        "use_case": "project_rebalance",
        "target_project_id": 2
      }
    },
    {
      "level": "info",
      "stage": "strict_rules",
      "event_type": "strict_rules.scope_selected",
      "message": "Selected 8 projects and 15 employees for strict rules.",
      "metadata": {
        "projects_in_scope": 8,
        "employees_in_scope": 15,
        "project_ids": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8
        ],
        "employee_ids": [
          2,
          4,
          6,
          7,
          10,
          11,
          12,
          13,
          15,
          16,
          17,
          18,
          19,
          20,
          21
        ]
      }
    },
    {
      "level": "info",
      "stage": "strict_rules",
      "event_type": "strict_rules.coverage_computed",
      "message": "Computed current coverage for scoped projects.",
      "metadata": {
        "1": {
          "headcount_gap": 2,
          "skill_gap": {
            "android": 1,
            "ios": 0,
            "web": 1,
            "backend": 1,
            "infrastructure": 0,
            "ai": 0
          },
          "coverage_ratio": 0.7028
        },
        "2": {
          "headcount_gap": 3,
          "skill_gap": {
            "android": 1,
            "ios": 0,
            "web": 1,
            "backend": 1,
            "infrastructure": 0,
            "ai": 0
          },
          "coverage_ratio": 0.6389
        },
        "3": {
          "headcount_gap": 1,
          "skill_gap": {
            "android": 0,
            "ios": 0,
            "web": 1,
            "backend": 0,
            "infrastructure": 0,
            "ai": 0
          },
          "coverage_ratio": 0.8722
        },
        "4": {
          "headcount_gap": 0,
          "skill_gap": {
            "android": 0,
            "ios": 0,
            "web": 0,
            "backend": 0,
            "infrastructure": 0,
            "ai": 0
          },
          "coverage_ratio": 1
        },
        "5": {
          "headcount_gap": 2,
          "skill_gap": {
            "android": 0,
            "ios": 1,
            "web": 0,
            "backend": 1,
            "infrastructure": 1,
            "ai": 1
          },
          "coverage_ratio": 0.5556
        },
        "6": {
          "headcount_gap": 0,
          "skill_gap": {
            "android": 0,
            "ios": 0,
            "web": 0,
            "backend": 1,
            "infrastructure": 0,
            "ai": 0
          },
          "coverage_ratio": 0.9667
        },
        "7": {
          "headcount_gap": 2,
          "skill_gap": {
            "android": 1,
            "ios": 0,
            "web": 1,
            "backend": 0,
            "infrastructure": 0,
            "ai": 0
          },
          "coverage_ratio": 0.6889
        },
        "8": {
          "headcount_gap": 3,
          "skill_gap": {
            "android": 1,
            "ios": 1,
            "web": 0,
            "backend": 0,
            "infrastructure": 0,
            "ai": 0
          },
          "coverage_ratio": 0.6667
        }
      }
    },
    {
      "level": "info",
      "stage": "strict_rules",
      "event_type": "strict_rules.candidates_generated",
      "message": "Generated 957 valid candidate plans.",
      "metadata": {
        "generated_candidate_count": 957,
        "persisted_candidate_count": 25
      }
    },
    {
      "level": "info",
      "stage": "strict_rules",
      "event_type": "strict_rules.candidates_pruned",
      "message": "Kept top 25 strict-rule candidates.",
      "metadata": {
        "candidate_count": 25
      }
    },
    {
      "level": "info",
      "stage": "strict_rules",
      "event_type": "strict_rules.completed",
      "message": "Completed strict rules with 25 candidates.",
      "metadata": {
        "candidate_count": 25
      }
    },
    {
      "level": "info",
      "stage": "llm_evaluation",
      "event_type": "llm_evaluation.started",
      "message": "Started OpenAI evaluation of strict-rule candidates.",
      "metadata": {
        "candidate_count": 25,
        "hiring_gap_hint_count": 0
      }
    },
    {
      "level": "info",
      "stage": "llm_evaluation",
      "event_type": "llm_evaluation.completed",
      "message": "OpenAI selected plan_01 and returned 2 ranked recommendations.",
      "metadata": {
        "selected_candidate_plan_id": "plan_01",
        "recommendation_count": 2
      }
    }
  ]
}