// This file acts as an internal "handbook" of formulas for the MATH node.
// It allows the system to generate reliable mathematical models for common concepts
// without needing to make an external API call, increasing speed and reliability.

export const mathKnowledgeBase: Record<string, Record<string, string>> = {
  cosmology: {
    hawking_temperature: "T_H = (ħ * c^3) / (8 * π * G * M * k_B)",
    holographic_principle: "S ≤ A / (4 * l_P^2)",
    friedmann_equation: "H^2 = (8 * π * G / 3) * ρ - (k * c^2 / a^2) + (Λ * c^2 / 3)",
    special_relativity_energy: "E = m * c^2"
  },
  information_theory: {
    shannon_entropy: "H(X) = -Σ(p(x_i) * log_b(p(x_i)))",
    mutual_information: "I(X;Y) = H(X) - H(X|Y)",
    channel_capacity: "C = B * log2(1 + S/N)"
  },
  basic_models: {
    oscillation: "f(t) = A * sin(ω * t + φ)",
    linear_growth: "y = m * x + c",
    exponential_decay: "N(t) = N0 * e^(-λ * t)",
    logistic_growth: "P(t) = K / (1 + ((K - P0) / P0) * e^(-r * t))"
  },
  quantum_mechanics: {
    schrodinger_equation: "i * ħ * (∂/∂t)Ψ(r, t) = [(-ħ^2 / 2m)∇^2 + V(r, t)]Ψ(r, t)",
    heisenberg_uncertainty: "σ_x * σ_p ≥ ħ / 2"
  }
};
