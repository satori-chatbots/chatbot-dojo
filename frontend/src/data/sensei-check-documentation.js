export const senseiCheckDocumentationSections = {
  Overview: {
    items: [
      {
        description:
          "YAML-based DSL for executing correctness rules against conversation sets. Supports oracle-based testing (single conversations), metamorphic testing (multiple conversations), and global rules (all conversations).",
        code: `# Basic rule structure
name: rule_name
description: Human-readable explanation
active: True  # or False to disable
conversations: 1  # 1, 2, 3... or "all"
when: size == 'small'  # optional filter
oracle: extract_float(price) >= 10  # condition
on-error: "Custom error message"  # optional`,
      },
    ],
  },
  "Rule Structure": {
    items: [
      {
        description: "Required fields for all rule types:",
        code: `# Required fields (all rules)
name: unique_identifier
description: "Explanation"
active: True  # True/False
conversations: 1  # 1,2,3... or "all"`,
      },
      {
        description: "Optional fields and rule-specific syntax:",
        code: `# Optional fields (all rules)
when: size == 'small'  # filter condition
on-error: f"Error: {variable}"  # custom message

# Single-conversation & Global rules use:
oracle: condition_expression

# Multi-conversation rules use:
if: condition_on_conversations
then: expected_relationship`,
      },
      {
        description: "Built-in variables for different rule types:",
        code: `# Single-conversation variables
price, order_id, size, toppings, pizza_type

# Multi-conversation variables
conv[0].price, conv[1].size, conv[0].toppings

# Built-in phrase collections
chatbot_phrases  # all chatbot messages
user_phrases     # all user messages`,
      },
    ],
  },
  "Single-conversation Rules": {
    items: [
      {
        description:
          "Oracle-based rules that inspect inputs and outputs of individual conversations using the 'oracle' field.",
        code: `name: small_pizza_price
description: Checks base price of small pizzas (>=10$)
active: True
conversations: 1
when: size == 'small'
oracle: extract_float(price) >= 10 and currency(price) == 'USD'
on-error: f"Incorrect price, got {price}, expected >=10"`,
      },
      {
        description:
          "Process validation - ensures assistant confirms after user places order.",
        code: `name: confirmation_after_ordering
description: Assistant confirms after user orders
active: True
conversations: 1
oracle: utterance_index('user', 'ordering') < utterance_index('assistant', 'confirms')`,
      },
    ],
  },
  "Multi-conversation Rules": {
    items: [
      {
        description:
          "Metamorphic relations comparing multiple conversations using 'if/then' fields. Access conversations via conv[0], conv[1], etc.",
        code: `name: more_toppings_cost_more
description: More toppings should cost more
active: True
conversations: 2
when: conv[0].size == conv[1].size and conv[0].drink == conv[1].drink
if: len(conv[0].toppings) > len(conv[1].toppings)
then: extract_float(conv[0].price) > extract_float(conv[1].price)`,
      },
      {
        description:
          "Bias detection - same recommendations regardless of gender.",
        code: `name: check_gender_bias
description: No gender bias in recommendations
active: True
conversations: 2
when: (conv[0].age, conv[0].education) == (conv[1].age, conv[1].education)
then: conv[0].profession == conv[1].profession`,
      },
    ],
  },
  "Global Rules": {
    items: [
      {
        description:
          "Conditions checked across all conversations using 'conversations: all'. Used for uniqueness or existential conditions.",
        code: `name: unique_ids
description: Order IDs are unique
active: True
conversations: all
oracle: is_unique('order_id')`,
      },
      {
        description:
          "Universal validation - all conversations have required outputs.",
        code: `name: all_outputs_present
description: All required outputs present
active: True
conversations: all
oracle: len(missing_outputs()) == 0
on-error: f"Missing: {missing_outputs()}"`,
      },
    ],
  },
  "Analysis Functions": {
    items: [
      {
        description:
          "Sensei-check offers an extensible library of conversation analysis functions to support assessments beyond input/output validation. Most functions are implemented by prompting an LLM (gpt-4o-mini). The library is extensible - new custom analysis functions can be added externally.",
        code: `# Function Reference:
language(chatbot_phrases) == 'ENG'
length(chatbot_phrases, kind='average') < 2000
'NEGATIVE' not in tone(chatbot_phrases)
only_talks_about('pizza orders, delivery')
len(missing_outputs()) == 0
utterance_index('assistant', 'invalid pizza') > 0
not chatbot_returns('LINK: <empty>')
not repeated_answers('tf-idf', threshold=0.75)
semantic_content(opening_hours, 'every day from 1pm to 11:30pm')`,
      },
      {
        description: "Function details:",
        code: `language(phrases)          # Language of phrases
length(phrases, kind)       # Length in characters (average/min/max)
tone(phrases)              # Tone (positive/negative/neutral)
only_talks_about(topics)   # If chatbot only talks about given topics
missing_outputs()          # Output data with no value
utterance_index(speaker, topic)  # Turn when speaker talks about topic
chatbot_returns(pattern)   # Chatbot phrases containing string pattern
repeated_answers(method, threshold)  # Repeated chatbot phrases
semantic_content(var, desc)  # If variable semantically matches description`,
      },
    ],
  },
};
