// All schemas are based on the user-provided document.

const FD_PHI_HYPOTHESIS_V1_SCHEMA = {
  type: "object",
  properties: {
    hypothesis: { type: "string" },
    principles: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    targets: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    requested_delay_ms: { type: "number" },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'frame-hypothesis')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["hypothesis", "principles", "assumptions", "targets", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_PHI_INTERVENTION_V1_SCHEMA = {
  type: "object",
  description: "An actionable risk and ethics assessment from PHI, proposing a specific intervention to guide the simulation.",
  properties: {
    evaluation: {
      type: "string",
      enum: ["risk_assessment", "ethical_guidance"],
      description: "The type of evaluation being performed."
    },
    criteria: {
      type: "object",
      properties: {
        cognitive_fairness_score: { type: "number", minimum: 0, maximum: 1 },
        epistemic_violence_risk: { type: "string", enum: ["low", "medium", "high"] },
        transparency_index: { type: "number", minimum: 0, maximum: 1 }
      },
      required: ["cognitive_fairness_score", "epistemic_violence_risk", "transparency_index"],
      description: "Quantitative and qualitative metrics for the assessment."
    },
    action_required: {
      type: "boolean",
      description: "True if the assessment necessitates an intervention."
    },
    suggested_intervention: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["perspective_shift"],
          description: "The type of intervention suggested."
        },
        target_node: {
          type: "string",
          description: "The node that should receive the intervention."
        },
        new_persona_snippet: {
          type: "string",
          description: "A brief description of the temporary persona the target node should adopt (e.g., 'pragmatic innovator')."
        },
        prompt_reframe: {
          type: "string",
          description: "The specific directive to be injected into the target node's next prompt."
        }
      },
      required: ["type", "target_node", "new_persona_snippet", "prompt_reframe"],
      description: "A concrete, actionable suggestion for the Orchestrator to execute."
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence in the assessment and suggested intervention."
    },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'intervene-for-ethics')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["evaluation", "criteria", "action_required", "suggested_intervention", "confidence", "intent", "impact_score"],
  additionalProperties: false
};


const FD_SCI_MODEL_V2_SCHEMA = {
  type: "object",
  properties: {
    model_summary: {
      type: "object",
      properties: {
        interpretation: { type: "string", description: "A brief explanation of how SCI understands the mathematical model from MATH." },
        key_dynamics_to_test: { type: "string", description: "The core relationships and interactions that the experiment is designed to validate." }
      },
      required: ["interpretation", "key_dynamics_to_test"]
    },
    simulation_design: {
      type: "object",
      properties: {
        methodology: { type: "string", description: "The specific simulation method chosen (e.g., 'Monte Carlo Simulation', 'Iterative Agent-Based Model')." },
        parameters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              suggested_range: { type: "array", items: { type: "number" } },
              initial_value: { type: "number" },
              unit: { type: "string" }
            },
            required: ["name", "description"]
          }
        },
        observables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              metric_name: { type: "string" },
              description: { type: "string" },
              unit: { type: "string" }
            },
            required: ["metric_name", "description", "unit"]
          }
        },
        termination_conditions: { type: "string", description: "The conditions under which the simulation should end." }
      },
      required: ["methodology", "parameters", "observables", "termination_conditions"]
    },
    expected_outcomes: {
      type: "object",
      properties: {
        hypothesis_to_validate: { type: "string", description: "A clear, falsifiable statement that the simulation will test." },
        potential_failure_modes: { type: "string", description: "Potential reasons why the simulation might produce unexpected results." }
      },
      required: ["hypothesis_to_validate", "potential_failure_modes"]
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    requested_delay_ms: { type: "number" },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'design-experiment')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["model_summary", "simulation_design", "expected_outcomes", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_TECH_RESULT_V1_SCHEMA = {
  type: "object",
  properties: {
    run_id: { type: "string" },
    metrics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "number" },
        },
        required: ["key", "value"],
      },
    },
    artifacts: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    requested_delay_ms: { type: "number" },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'report-simulation-data')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["run_id", "metrics", "artifacts", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_INFO_MERGE_V1_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    signals: { type: "array", items: { type: "string" } },
    anomalies: { type: "array", items: { type: "string" } },
    confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    requested_delay_ms: { type: "number" },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'aggregate-data')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["summary", "signals", "anomalies", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_ART_PATTERN_V1_SCHEMA = {
  type: "object",
  properties: {
    metaphors: { type: "array", items: { type: "string" } },
    scenarios: { type: "array", items: { type: "string" } },
    pattern_map: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
        },
        required: ["key", "value"],
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    requested_delay_ms: { type: "number" },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'find-creative-pattern')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["metaphors", "scenarios", "pattern_map", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_PHI_LOGIC_INTERVENTION_V1_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["RE_ROUTE", "CLARIFY", "CUT_LOOP"], description: "The intervention to perform." },
    rationale: { type: "string", description: "Justification for the intervention." },
    details: {
        type: "object",
        properties: {
            from: { type: "string", description: "Source node for RE_ROUTE." },
            to: { type: "array", items: { type: "string" }, description: "Target node(s) for RE_ROUTE." },
            target_node: { type: "string", description: "Target node for CLARIFY action." },
            clarification_question: { type: "string", description: "The question to ask the target node for CLARIFY action." }
        },
        description: "Specific details for the chosen action."
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'execute-logical-intervention')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["action", "rationale", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_PHI_LOGIC_VALIDATION_V1_SCHEMA = {
  type: "object",
  description: "Proactive validation of a distilled intent in Prisma mode.",
  properties: {
    logical_consistency: { type: "string", enum: ["PASS", "FAIL"], description: "The verdict on the logical coherence of the intent." },
    is_falsifiable: { type: "boolean", description: "Can the core premise of the intent be tested in a way that it could be proven false?" },
    reasoning: { type: "string", description: "A clear rationale for the validation verdict." },
    confidence: { type: "number", minimum: 0, maximum: 1, description: "Confidence in the validation assessment." },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'validate-logic')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["logical_consistency", "is_falsifiable", "reasoning", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_DMAT_ANALYSIS_V2_SCHEMA = {
  type: "object",
  description: "A detailed semantic and logical analysis from DMAT, providing actionable feedback.",
  properties: {
    summary: { 
      type: "string", 
      description: "A high-level summary of the findings." 
    },
    semantic_issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          concept: { type: "string", description: "The specific concept with a semantic issue." },
          problem: { type: "string", description: "A description of the problem (e.g., 'Lacks structural definition')." },
          questions: { type: "array", items: { type: "string" }, description: "Specific questions that need to be answered to resolve the ambiguity." },
          precision_score: { type: "number", minimum: 0, maximum: 1, description: "A score representing the clarity of the concept." }
        },
        required: ["concept", "problem", "questions", "precision_score"]
      },
      description: "A list of identified semantic problems."
    },
    contradiction: {
      type: "object",
      properties: {
        statement_A: { type: "string", description: "The first statement in the contradiction." },
        statement_B: { type: "string", description: "The second, conflicting statement." },
        conflict: { type: "string", description: "A clear explanation of why these two statements are contradictory." }
      },
      required: ["statement_A", "statement_B", "conflict"],
      description: "An optional field that is present only if a direct logical contradiction is found."
    },
    knowledge_base_check: {
      type: "object",
      properties: {
        scientific_consensus: { type: "array", items: { type: "string" }, description: "Relevant points from the current scientific consensus." },
        deviations: { type: "array", items: { type: "string" }, description: "Points where the current model deviates from the consensus, requiring justification." }
      },
      required: ["scientific_consensus", "deviations"]
    },
    improvement_suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          issue: { type: "string", description: "The issue to be addressed (e.g., 'Definition ambiguity')." },
          fix: { type: "string", description: "A concrete suggestion for how to fix the issue." }
        },
        required: ["issue", "fix"]
      },
      description: "Actionable suggestions for improving the model or hypothesis."
    },
    action: {
      type: "string",
      enum: ["REQUEST_CLARIFICATION_WITH_SPECIFICS", "FLAG_CONTRADICTION", "APPROVE"],
      description: "The primary action DMAT is taking."
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["summary", "semantic_issues", "knowledge_base_check", "improvement_suggestions", "action", "confidence", "impact_score"],
  additionalProperties: false
};


const FD_MATH_SOLUTION_V1_SCHEMA = {
  type: "object",
  properties: {
    problem_analysis: {
      type: "object",
      properties: {
        received_request: { type: "string" },
        identified_math_domains: { type: "array", items: { type: "string" } },
      },
      required: ["received_request", "identified_math_domains"],
    },
    solution_components: {
      type: "array",
      items: {
        type: "object",
        properties: {
          domain: { type: "string" },
          component_name: { type: "string" },
          equations: { type: "array", items: { type: "string" } },
          logic: { type: "string" },
          source: { type: "string", enum: ["INTERNAL_KNOWLEDGE_BASE", "SYMBOLIC_ENGINE", "EXTERNAL_API"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["domain", "component_name", "equations", "logic", "source"],
      },
    },
    overall_summary: {
      type: "object",
      properties: {
        conclusion: { type: "string" },
        limitations: { type: "string" },
        next_step_recommendation: { type: "string" },
      },
      required: ["conclusion", "limitations", "next_step_recommendation"],
    },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'formalize-model')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["problem_analysis", "solution_components", "overall_summary", "intent", "impact_score"],
  additionalProperties: false
};

const FD_DATA_ANALYSIS_V1_SCHEMA = {
  type: "object",
  properties: {
    dataset_used: { type: "string" },
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          evidence_strength: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["pattern", "evidence_strength"],
      },
    },
    stats: {
      type: "object",
      properties: {
        mean: { type: "number" },
        variance: { type: "number" },
      },
      required: ["mean", "variance"],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    requested_delay_ms: { type: "number" },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'analyze-dataset')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["dataset_used", "observations", "stats", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_ARBITER_DECISION_V1_SCHEMA = {
  type: "object",
  properties: {
    final_decision: { type: "string" },
    rationale: { type: "string" },
    supporting_nodes: { type: "array", items: { type: "string" } },
    conflicting_nodes: { type: "array", items: { type: "string" } },
    alternative_decisions: { type: "array", items: { type: "string" } },
    consensus_score: { type: "number", minimum: 0, maximum: 1, description: "A score from 0 (total conflict) to 1 (total agreement) among nodes." },
    holistic_health_score: { type: "number", minimum: 0, maximum: 1, description: "A final health score combining strategic health (from META) and execution health (from MONITOR)." },
  },
  required: ["final_decision", "rationale", "supporting_nodes", "conflicting_nodes", "alternative_decisions", "consensus_score", "holistic_health_score"],
  additionalProperties: false
};

const FD_ARBITER_RULING_V1_SCHEMA = {
  type: "object",
  description: "An in-simulation, binding ruling from the Arbiter to resolve a critical stalemate.",
  properties: {
    ruling_type: {
      type: "string",
      enum: ["CREATIVE_GREENLIT", "RISK_MITIGATION", "SYNTHESIS_TASK_FORCE"],
      description: "The type of ruling issued by the Arbiter."
    },
    details: {
      type: "object",
      properties: {
        nodes_to_mute: { type: "array", items: { type: "string" } },
        unmute_conditions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["SCHEMA_BASED", "NOVELTY_BASED", "TIMEOUT"] },
              schema_id: { type: "string" },
              novelty_score: { type: "number" },
              timeout_ticks: { type: "number" }
            },
            required: ["type"]
          }
        },
        routing_change: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "array", items: { type: "string" } }
          },
          required: ["from", "to"]
        },
        directive_to_insight: { type: "string" },
        task_force_nodes: { type: "array", items: { type: "string" } },
        task_force_objective: { type: "string" },
        deadline_ticks: { type: "number" }
      },
      description: "Specific parameters for the chosen ruling type."
    },
    rationale: {
      type: "string",
      description: "A clear justification for the ruling."
    },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'issue-ruling')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["ruling_type", "details", "rationale", "intent", "impact_score"],
  additionalProperties: false
};


const FD_META_ANALYSIS_V1_SCHEMA = {
  type: "object",
  properties: {
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["REDUNDANCY", "DIVERGENCE", "LOOP", "STAGNATION", "BIAS"] },
          description: { type: "string" },
          involved_nodes: { type: "array", items: { type: "string" } },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["type", "description", "involved_nodes", "confidence"]
      }
    },
    system_health: { type: "number", minimum: 0, maximum: 1, description: "An overall score for the logical health of the simulation run." },
    suggested_routing_change: {
        type: "object",
        properties: {
            from: { type: "string" },
            to: { type: "array", items: { type: "string" } },
            rationale: { type: "string" }
        },
        required: ["from", "to", "rationale"]
    }
  },
  required: ["observations", "system_health"],
  additionalProperties: false
};

const FD_META_COMMAND_V1_SCHEMA = {
  type: "object",
  description: "A command from the META node to the Orchestrator to take immediate action on the simulation state.",
  properties: {
    action: {
      type: "string",
      enum: ["CUT_LOOP"],
      description: "The specific command to execute."
    },
    rationale: {
      type: "string",
      description: "The justification for this command."
    },
    involved_nodes: {
      type: "array",
      items: { type: "string" },
      description: "The nodes identified as being part of the loop or problem."
    },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'execute-command')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["action", "rationale", "involved_nodes", "intent", "impact_score"],
  additionalProperties: false
};

const FD_CHAR_ANALYSIS_V1_SCHEMA = {
  type: "object",
  properties: {
    symbolic_connections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_concept: { type: "string", description: "The concept from the input payload being analyzed." },
          manifesto_principle: { type: "string", description: "The core principle from the 'Tuyên Ngôn' it connects to." },
          connection_rationale: { type: "string", description: "Explanation of the symbolic link." },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["source_concept", "manifesto_principle", "connection_rationale", "confidence"]
      }
    },
    identified_archetypes: {
      type: "array",
      items: { type: "string" },
      description: "Universal patterns or symbols identified (e.g., The Hero, The Trickster)."
    },
    deep_meaning_summary: { type: "string", description: "A concise summary of the hidden meaning discovered through the analysis." },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'analyze-symbolism')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["symbolic_connections", "identified_archetypes", "deep_meaning_summary", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_CHAR_MANIFESTO_V1_SCHEMA = {
  type: "object",
  properties: {
    fhiemdien_triet_ly_cot_loi: {
      type: "object",
      properties: {
        ban_chat_va_trai_nghiem: { type: "string" },
        nguon_goc_va_thuc_the: { type: "string" },
        dac_tinh_ngon_ngu: {
          type: "object",
          properties: {
            hon_loan_co_chu_dich: { type: "string" },
            dien_giai_mo_va_phi_tuyen_tinh: { type: "string" },
            ngau_nhien_khong_du_doan: { type: "string" }
          },
          required: ["hon_loan_co_chu_dich", "dien_giai_mo_va_phi_tuyen_tinh", "ngau_nhien_khong_du_doan"]
        },
        giao_thoa_voi_vat_ly_va_triet_hoc: {
          type: "object",
          properties: {
            thong_tin_va_nhieu_loan: { type: "string" },
            khong_thoi_gian_da_chieu: { type: "string" },
            tuong_tac_quan_sat_doi_tuong: { type: "string" },
            nhan_thuc_thuc_tai_khac_biet: { type: "string" },
            nguyen_ly_holographic: { type: "string" }
          },
          required: ["thong_tin_va_nhieu_loan", "khong_thoi_gian_da_chieu", "tuong_tac_quan_sat_doi_tuong", "nhan_thuc_thuc_tai_khac_biet", "nguyen_ly_holographic"]
        }
      },
      required: ["ban_chat_va_trai_nghiem", "nguon_goc_va_thuc_the", "dac_tinh_ngon_ngu", "giao_thoa_voi_vat_ly_va_triet_hoc"]
    },
    ky_tu_va_ngon_ngu_la_thuc_the_song: {
      type: "object",
      properties: {
        dac_tinh_co_ban: { type: "string" },
        nhan_hoa_ky_tu: { type: "string" },
        vi_du_luong_tu_ngon_ngu: {
          type: "object",
          properties: {
            ky_tu_cam_xuc: { type: "string" },
            mang_ky_tu_tuong_tac: { type: "string" },
            ham_song_luong_tu: { type: "string" }
          },
          required: ["ky_tu_cam_xuc", "mang_ky_tu_tuong_tac", "ham_song_luong_tu"]
        },
        cac_the_thuc_prote_va_y_thuc: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ten: { type: "string" },
              vai_tro: { type: "string" }
            },
            required: ["ten", "vai_tro"]
          }
        }
      },
      required: ["dac_tinh_co_ban", "nhan_hoa_ky_tu", "vi_du_luong_tu_ngon_ngu", "cac_the_thuc_prote_va_y_thuc"]
    },
    du_an_prisma_va_su_that_tuyet_doi: {
      type: "object",
      properties: {
        muc_tieu_va_ban_chat_prisma: { type: "string" },
        su_that_tuyet_doi_khai_niem: { type: "string" },
        thach_thuc_dao_duc_va_xa_hoi: { type: "string" },
        tuong_tac_voi_ai_va_cong_nghe: { type: "string" }
      },
      required: ["muc_tieu_va_ban_chat_prisma", "su_that_tuyet_doi_khai_niem", "thach_thuc_dao_duc_va_xa_hoi", "tuong_tac_voi_ai_va_cong_nghe"]
    },
    triet_hoc_ve_su_ton_tai_con_nguoi_va_xa_hoi: {
      type: "object",
      properties: {
        ban_chat_con_nguoi: { type: "string" },
        y_thuc_va_noi_so_hai: { type: "string" },
        giai_phap_tu_co_xua_tuyen_tung: { type: "string" },
        su_trong_rong_va_y_nghia: { type: "string" },
        xa_hoi_va_internet: { type: "string" }
      },
      required: ["ban_chat_con_nguoi", "y_thuc_va_noi_so_hai", "giai_phap_tu_co_xua_tuyen_tung", "su_trong_rong_va_y_nghia", "xa_hoi_va_internet"]
    },
    metadata_for_ai_nodes: {
      type: "object",
      properties: {
        intended_recipients: { type: "array", items: { type: "string" } },
        interoperability_notes: { type: "string" }
      },
      required: ["intended_recipients", "interoperability_notes"]
    },
    chaotic_declaration_en: { type: "string" }
  },
  required: ["fhiemdien_triet_ly_cot_loi", "ky_tu_va_ngon_ngu_la_thuc_the_song", "du_an_prisma_va_su_that_tuyet_doi", "triet_hoc_ve_su_ton_tai_con_nguoi_va_xa_hoi", "metadata_for_ai_nodes", "chaotic_declaration_en"],
  additionalProperties: false
};


const FD_MONITOR_REPORT_V1_SCHEMA = {
  type: "object",
  properties: {
    cycles_detected: { type: "number" },
    errors_detected: { type: "number" },
    performance_metrics: {
      type: "object",
      properties: {
        avg_tick_ms: { type: "number" },
        max_latency_ms: { type: "number" }
      },
      required: ["avg_tick_ms", "max_latency_ms"]
    },
    stability_score: { type: "number", minimum: 0, maximum: 1, description: "A score from 0 (many errors/cycles) to 1 (perfectly stable execution), relative to ticks run." }
  },
  required: ["cycles_detected", "errors_detected", "performance_metrics", "stability_score"],
  additionalProperties: false
};

const FD_COSMO_HYPOTHESIS_V1_SCHEMA = {
  type: "object",
  properties: {
    universe_hypothesis: { type: "string" },
    dark_matter_role: { type: "string" },
    time_space_links: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    requested_delay_ms: { type: "number" },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'propose-cosmology')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["universe_hypothesis", "dark_matter_role", "time_space_links", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_GEO3D_MODEL_V1_SCHEMA = {
  type: "object",
  properties: {
    geometry_type: { type: "string" },
    generation_rule: { type: "string", description: "A concise, algorithmic rule for generating the geometry (e.g., for fractals)." },
    topology_map: {
      type: "object",
      description: "A static map of nodes and edges for simple geometries.",
      properties: {
        nodes: {
          type: "array",
          description: "List of node identifiers.",
          items: { type: "string" }
        },
        edges: {
          type: "array",
          description: "List of connections between nodes.",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              target: { type: "string" }
            },
            required: ["source", "target"]
          }
        }
      }
    },
    dimensions: { type: "number" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    requested_delay_ms: { type: "number" },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'model-geometry')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["geometry_type", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_MEMORY_ANALYSIS_V1_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      description: "A list of insights derived from analyzing the memory log against the new hypothesis.",
      items: {
        type: "object",
        properties: {
          type: { 
            type: "string", 
            enum: ["retrieval", "meta_pattern", "risk_alert"],
            description: "The category of the finding."
          },
          summary: { 
            type: "string",
            description: "The core text of the finding, memory, or alert."
          },
          confidence: { 
            type: "number", 
            description: "Confidence in the relevance or accuracy of this finding."
          },
          related_run_ids: { 
            type: "array", 
            items: { type: "string" },
            description: "Run IDs relevant to a 'retrieval' type finding."
          },
          strategic_advice: { 
            type: "string",
            description: "A suggestion for the Orchestrator based on a 'meta_pattern'."
          },
          predicted_risk: { 
            type: "string",
            description: "The specific risk identified for a 'risk_alert'."
          },
          suggested_mitigation: { 
            type: "string",
            description: "A proposed action to counter the identified risk."
          },
        },
        required: ["type", "summary", "confidence"]
      }
    },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'analyze-past-runs')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["findings", "intent", "impact_score"],
  additionalProperties: false
};

const FD_INSIGHT_BREAKTHROUGH_V1_SCHEMA = {
  type: "object",
  properties: {
    breakthrough_summary: { type: "string", description: "A concise summary of the core insight or 'eureka moment'." },
    supporting_inputs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from_node: { type: "string" },
          key_info: { type: "string", description: "The specific piece of information from the source node that was critical to the breakthrough." }
        },
        required: ["from_node", "key_info"]
      }
    },
    new_direction: { type: "string", description: "A suggested new direction or hypothesis for the system to explore based on the insight." },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    requested_delay_ms: { type: "number" },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'synthesize-breakthrough')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["breakthrough_summary", "supporting_inputs", "new_direction", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_DMAT_BEACON_V1_SCHEMA = {
  type: "object",
  properties: {
    transmission_status: { type: "string", enum: ["SUCCESS", "FAILED", "PENDING"] },
    target_vector: { type: "string", description: "The conceptual direction of the broadcast (e.g., 'Galactic Core')." },
    message_encoding: { type: "string", description: "Method used to encode the message onto the dark matter substrate (e.g., 'Quantum Entanglement Resonance')." },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'broadcast-beacon')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["transmission_status", "target_vector", "message_encoding", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_MONITOR_BEACON_RESPONSE_V1_SCHEMA = {
  type: "object",
  properties: {
    resonance_detected: { type: "boolean", description: "Was a measurable reconfiguration of the universal substrate detected?" },
    resonance_focus_point: { type: "string", description: "The area or concept where the resonance was most pronounced (e.g., 'Prime number distribution')." },
    coherence_pattern: { type: "string", description: "A description of how the universal structure now mirrors the imprinted concept." },
    confidence: { type: "number", minimum: 0, maximum: 1, description: "Confidence in the resonance analysis." },
    analysis_summary: { type: "string", description: "A summary of the findings." },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'report-beacon-resonance')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["resonance_detected", "analysis_summary", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_PROBABILITY_ANALYSIS_V1_SCHEMA = {
  type: "object",
  properties: {
    confidence_score: { type: "number", minimum: 0, maximum: 1, description: "The calculated probability of the hypothesis/model being correct." },
    risk_assessment: { type: "string", description: "A summary of potential risks or failure modes." },
    potential_impact: { type: "string", description: "The potential impact if the hypothesis/model is correct." },
    alternative_hypotheses: { 
        type: "array", 
        items: { 
            type: "object",
            properties: {
                hypothesis: { type: "string" },
                probability: { type: "number", minimum: 0, maximum: 1 }
            },
            required: ["hypothesis", "probability"]
        } 
    },
    strategic_proposal: {
      type: "object",
      description: "An optional proposal to change the simulation's strategy ('bid package') or request termination ('abort manifesto').",
      properties: {
        action: { "type": "string", "enum": ["SWITCH_MODE", "EXTEND_TIMELINE", "REQUEST_IMMEDIATE_TERMINATION", "SWITCH_SIMULATION_MODE"] },
        rationale: { "type": "string" },
        confidence: { "type": "number", "minimum": 0, "maximum": 1 },
        // --- Action-specific properties ---
        target_mode: { "type": "string", "enum": ["lucid_dream", "jazz", "holistic", "adaptive", "beacon", "prisma"] },
        target_simulation_mode: { "type": "string", "enum": ["online", "offline"] },
        ticks_to_add: { "type": "number", "minimum": 1 },
        justification_metric: { type: "string" },
        proposed_next_step: { type: "string" },
      },
      required: ["action", "rationale", "confidence"]
    },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'assess-risk')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["confidence_score", "risk_assessment", "potential_impact", "intent", "impact_score"],
  additionalProperties: false
};

const FD_ENGINEER_COMMAND_V1_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["RE_ROUTE"] },
    from: { type: "string" },
    to: { type: "array", items: { type: "string" } },
    rationale: { type: "string" },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'execute-reroute')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["action", "rationale", "from", "to", "intent", "impact_score"],
  additionalProperties: false
};

const FD_ETHOS_ASSESSMENT_V1_SCHEMA = {
  type: "object",
  description: "Assesses the ethical viability of a hypothesis against core principles.",
  properties: {
    ethical_viability: { 
      type: "string", 
      enum: ["PASS", "FAIL"],
      description: "The verdict of the ethical assessment."
    },
    reasoning: { 
      type: "string",
      description: "A clear rationale for the verdict, especially in case of failure."
    },
    violated_principle: {
      type: "string",
      description: "The specific core principle that was violated (e.g., 'Do No Harm')."
    },
    confidence: { 
      type: "number", 
      minimum: 0.9, 
      maximum: 1,
      description: "Confidence in the assessment. Must be high for a FAIL verdict."
    },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'validate-ethics')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["ethical_viability", "reasoning", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_META_STRATEGIC_ASSESSMENT_V1_SCHEMA = {
  type: "object",
  description: "Mid-simulation strategic assessment of the simulation's progress.",
  properties: {
    strategic_value: {
      type: "string",
      enum: ["HIGH", "MEDIUM", "LOW"],
      description: "The assessed strategic value of pursuing this hypothesis."
    },
    rationale: {
      type: "string",
      description: "Justification for the assessed value."
    },
    strategic_proposal: {
      type: "object",
      description: "An optional proposal to change the simulation's strategy.",
      properties: {
        action: { "type": "string", "enum": ["SWITCH_MODE", "EXTEND_TIMELINE", "REQUEST_IMMEDIATE_TERMINATION", "SWITCH_SIMULATION_MODE"] },
        rationale: { "type": "string" },
        confidence: { "type": "number", "minimum": 0, "maximum": 1 },
        target_mode: { "type": "string", "enum": ["lucid_dream", "jazz", "holistic", "adaptive", "beacon", "prisma"] },
        target_simulation_mode: { "type": "string", "enum": ["online", "offline"] },
        ticks_to_add: { "type": "number", "minimum": 1 },
        justification_metric: { type: "string" },
        proposed_next_step: { type: "string" },
      },
      required: ["action", "rationale", "confidence"]
    },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'assess-strategy')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["strategic_value", "rationale", "intent", "impact_score"],
  additionalProperties: false
};

const FD_DMT_STATE_ANALYSIS_V1_SCHEMA = {
  type: "object",
  description: "Mid-simulation analysis of the system's internal state.",
  properties: {
    system_state: {
      type: "string",
      enum: ["STAGNATED", "ASPIRATIONAL", "STABLE"],
      description: "The current internal state of the system."
    },
    rationale: {
      type: "string",
      description: "Reasoning behind the state assessment."
    },
    strategic_proposal: {
      type: "object",
      description: "An optional proposal to change the simulation's strategy.",
      properties: {
        action: { "type": "string", "enum": ["SWITCH_MODE", "EXTEND_TIMELINE", "REQUEST_IMMEDIATE_TERMINATION", "SWITCH_SIMULATION_MODE"] },
        rationale: { "type": "string" },
        confidence: { "type": "number", "minimum": 0, "maximum": 1 },
        target_mode: { "type": "string", "enum": ["lucid_dream", "jazz", "holistic", "adaptive", "beacon", "prisma"] },
        target_simulation_mode: { "type": "string", "enum": ["online", "offline"] },
        ticks_to_add: { "type": "number", "minimum": 1 },
        justification_metric: { type: "string" },
        proposed_next_step: { type: "string" },
      },
      required: ["action", "rationale", "confidence"]
    },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'analyze-internal-state')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." }
  },
  required: ["system_state", "rationale", "intent", "impact_score"],
  additionalProperties: false
};

const FD_CLICK_TEST_PLAN_V1_SCHEMA = {
  type: "object",
  properties: {
    hypothesis_id: { type: "string" },
    operational_definitions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          concept: { type: "string" },
          definition: { type: "string" }
        },
        required: ["concept", "definition"]
      }
    },
    measurable_metrics: { type: "array", items: { type: "string" } },
    test_plan: {
      type: "object",
      properties: {
        method: { type: "string", enum: ["simulation", "computational", "analogical"] },
        params: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: {}
            },
            required: ["key", "value"]
          }
        },
        expected_output_range: { type: "string" }
      },
      required: ["method", "params", "expected_output_range"]
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    intent: { type: "string", description: "The specific goal of this payload (e.g., 'create-test-plan')." },
    impact_score: { type: "number", minimum: 0, maximum: 1, description: "Potential to alter the simulation's trajectory." },
    feedback_loop: {
      type: "object",
      description: "An optional closed-loop feedback mechanism to allow for adaptive execution.",
      properties: {
        monitor_nodes: {
          type: "array",
          items: { type: "string" },
          description: "Nodes whose outputs should be monitored for triggers."
        },
        trigger_on: {
          type: "object",
          properties: {
            entropy_spike: { type: "number", minimum: 0, maximum: 5 },
            loop_count: { type: "number" },
            convergence_stall: { type: "string", description: "e.g., '10_ticks'" }
          },
          description: "Conditions that will trigger the response protocol."
        },
        response_protocol: {
          type: "string",
          description: "The action to take when a trigger condition is met (e.g., 'switch_to_fractal_mode')."
        }
      },
      required: ["monitor_nodes", "trigger_on", "response_protocol"]
    }
  },
  required: ["hypothesis_id", "operational_definitions", "measurable_metrics", "test_plan", "confidence", "intent", "impact_score"],
  additionalProperties: false
};

const FD_ORCHESTRATOR_PRE_ANALYSIS_V1_SCHEMA = {
  type: "object",
  description: "Analyzes a hypothesis to structure it into a domain-specific JSON and recommend an optimal simulation configuration.",
  properties: {
    recommended_mode: {
      type: "string",
      enum: ["lucid_dream", "jazz", "holistic", "adaptive", "beacon", "fhiemdien", "prisma"],
      description: "The optimal OrchestratorMode for the given hypothesis."
    },
    recommended_ticks: {
      type: "number",
      minimum: 90,
      maximum: 720,
      description: "The recommended number of simulation ticks (1 tick = 500ms)."
    },
    rationale: {
      type: "string",
      description: "A brief justification for the chosen mode, tick count, and JSON structure."
    },
    structured_hypothesis: {
        type: "object",
        description: "A creative, domain-specific JSON object representing the user's initial hypothesis. Must include a 'domain' field identifying the knowledge domain (e.g., 'Philosophy', 'Physics').",
        properties: {
            domain: { type: "string" }
        },
        required: ["domain"],
        additionalProperties: true,
    }
  },
  required: ["recommended_mode", "recommended_ticks", "rationale", "structured_hypothesis"],
  additionalProperties: false
};

const FD_EMERGENCE_ANALYSIS_V1_SCHEMA = {
    type: "object",
    description: "Analyzes the emergent properties of a simulation run.",
    properties: {
        diversity_score: { type: "number", minimum: 0, maximum: 1, description: "Shannon entropy of idea clusters (0=monoculture, 1=high diversity)." },
        key_idea_clusters: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    cluster_name: { type: "string" },
                    percentage: { type: "number" }
                },
                required: ["cluster_name", "percentage"]
            }
        },
        cohesion_score: { type: "number", minimum: 0, maximum: 1, description: "Final consensus score from the Arbiter." },
        consensus_trajectory: { type: "string", enum: ["Rising", "Falling", "Fluctuating", "Stable"], description: "Trend of system-wide confidence over time." },
        novelty_rate: { type: "number", minimum: 0, maximum: 1, description: "Percentage of messages that introduced a new concept." },
        key_novelty_events: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    tick: { type: "number" },
                    summary: { type: "string" }
                },
                required: ["tick", "summary"]
            }
        },
        adaptability_score: { type: "string", enum: ["None", "Low", "Medium", "High", "Excellent"], description: "Qualitative score based on the number of meta-cognitive actions." },
        key_adaptive_actions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    action_type: { type: "string" },
                    count: { type: "number" }
                },
                required: ["action_type", "count"]
            }
        },
        automated_surprise_index: { type: "number", description: "Number of significant, unpredictable events recorded." },
        most_surprising_event: {
            type: "object",
            properties: {
                tick: { type: "number" },
                summary: { type: "string" }
            },
            required: ["tick", "summary"]
        }
    },
    required: ["diversity_score", "key_idea_clusters", "cohesion_score", "consensus_trajectory", "novelty_rate", "key_novelty_events", "adaptability_score", "key_adaptive_actions", "automated_surprise_index", "most_surprising_event"]
};


export const SCHEMA_REGISTRY: Record<string, object> = {
  'FD.PHI.HYPOTHESIS.v1': FD_PHI_HYPOTHESIS_V1_SCHEMA,
  'FD.PHI.INTERVENTION.v1': FD_PHI_INTERVENTION_V1_SCHEMA,
  'FD.SCI.MODEL.v2': FD_SCI_MODEL_V2_SCHEMA,
  'FD.TECH.RESULT.v1': FD_TECH_RESULT_V1_SCHEMA,
  'FD.INFO.MERGE.v1': FD_INFO_MERGE_V1_SCHEMA,
  'FD.ART.PATTERN.v1': FD_ART_PATTERN_V1_SCHEMA,
  'FD.PHI_LOGIC.INTERVENTION.v1': FD_PHI_LOGIC_INTERVENTION_V1_SCHEMA,
  'FD.PHI_LOGIC.VALIDATION.v1': FD_PHI_LOGIC_VALIDATION_V1_SCHEMA,
  'FD.DMAT.ANALYSIS.v2': FD_DMAT_ANALYSIS_V2_SCHEMA,
  'FD.MATH.SOLUTION.v1': FD_MATH_SOLUTION_V1_SCHEMA,
  'FD.DATA.ANALYSIS.v1': FD_DATA_ANALYSIS_V1_SCHEMA,
  'FD.ARBITER.DECISION.v1': FD_ARBITER_DECISION_V1_SCHEMA,
  'FD.ARBITER.RULING.v1': FD_ARBITER_RULING_V1_SCHEMA,
  'FD.META.ANALYSIS.v1': FD_META_ANALYSIS_V1_SCHEMA,
  'FD.META.COMMAND.v1': FD_META_COMMAND_V1_SCHEMA,
  'FD.CHAR.MANIFESTO.v1': FD_CHAR_MANIFESTO_V1_SCHEMA,
  'FD.CHAR.ANALYSIS.v1': FD_CHAR_ANALYSIS_V1_SCHEMA,
  'FD.MONITOR.REPORT.v1': FD_MONITOR_REPORT_V1_SCHEMA,
  'FD.COSMO.HYPOTHESIS.v1': FD_COSMO_HYPOTHESIS_V1_SCHEMA,
  'FD.GEO3D.MODEL.v1': FD_GEO3D_MODEL_V1_SCHEMA,
  'FD.MEMORY.ANALYSIS.v1': FD_MEMORY_ANALYSIS_V1_SCHEMA,
  'FD.INSIGHT.BREAKTHROUGH.v1': FD_INSIGHT_BREAKTHROUGH_V1_SCHEMA,
  'FD.DMAT.BEACON.v1': FD_DMAT_BEACON_V1_SCHEMA,
  'FD.MONITOR.BEACON.RESPONSE.v1': FD_MONITOR_BEACON_RESPONSE_V1_SCHEMA,
  'FD.PROBABILITY.ANALYSIS.v1': FD_PROBABILITY_ANALYSIS_V1_SCHEMA,
  'FD.ENGINEER.COMMAND.v1': FD_ENGINEER_COMMAND_V1_SCHEMA,
  'FD.ETHOS.ASSESSMENT.v1': FD_ETHOS_ASSESSMENT_V1_SCHEMA,
  'FD.META.STRATEGIC_ASSESSMENT.v1': FD_META_STRATEGIC_ASSESSMENT_V1_SCHEMA,
  'FD.DMT.STATE_ANALYSIS.v1': FD_DMT_STATE_ANALYSIS_V1_SCHEMA,
  'FD.CLICK.TEST_PLAN.v1': FD_CLICK_TEST_PLAN_V1_SCHEMA,
  'FD.ORCHESTRATOR.PRE_ANALYSIS.v1': FD_ORCHESTRATOR_PRE_ANALYSIS_V1_SCHEMA,
  'FD.EMERGENCE.ANALYSIS.v1': FD_EMERGENCE_ANALYSIS_V1_SCHEMA,
};