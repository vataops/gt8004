package alert

// RuleType defines the category of an alert rule.
type RuleType string

const (
	RuleTypePerformance RuleType = "performance"
	RuleTypeCustomer    RuleType = "customer"
	RuleTypeRevenue     RuleType = "revenue"
)

// Operator defines the comparison operator for alert evaluation.
type Operator string

const (
	OpGreaterThan      Operator = "gt"
	OpLessThan         Operator = "lt"
	OpGreaterThanEqual Operator = "gte"
	OpLessThanEqual    Operator = "lte"
	OpEqual            Operator = "eq"
)

// Evaluate checks whether the given value triggers an alert based on the operator and threshold.
func Evaluate(value float64, op Operator, threshold float64) bool {
	switch op {
	case OpGreaterThan:
		return value > threshold
	case OpLessThan:
		return value < threshold
	case OpGreaterThanEqual:
		return value >= threshold
	case OpLessThanEqual:
		return value <= threshold
	case OpEqual:
		return value == threshold
	default:
		return false
	}
}
