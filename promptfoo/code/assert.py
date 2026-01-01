import sys
import json
import io
from contextlib import redirect_stdout


def get_assert(output, context):
    try:
        vars = context["vars"]
        test_code = vars.get("test_code")
        expected_output = vars.get("expected_output")

        if test_code is None or expected_output is None:
            return {
                "pass": True,
                "score": 1,
                "reason": "No test code or expected output provided",
            }

        expected_output = str(expected_output)

        # Clean up code (remove markdown)
        clean_code = output.replace("```python", "").replace("```", "").strip()

        # Prepare execution environment
        global_env = {}
        exec("from typing import List, Optional, Dict, Set, Tuple", global_env)

        # Capture stdout
        f = io.StringIO()
        with redirect_stdout(f):
            # Execute the generated code class definition
            exec(clean_code, global_env)
            # Execute the test code
            exec(test_code, global_env)

        actual_output = f.getvalue().strip()

        # Compare
        expected_clean = expected_output
        if expected_clean.startswith('"') and expected_clean.endswith('"'):
            expected_clean = expected_clean[1:-1]
        elif expected_clean.startswith("'") and expected_clean.endswith("'"):
            expected_clean = expected_clean[1:-1]

        if actual_output == expected_clean:
            return {"pass": True, "score": 1, "reason": "Output matched"}
        else:
            return {
                "pass": False,
                "score": 0,
                "reason": f"Expected '{expected_clean}', got '{actual_output}'",
            }
    except Exception as e:
        return {"pass": False, "score": 0, "reason": f"Error executing code: {str(e)}"}


if __name__ == "__main__":
    # Get arguments
    output_code = sys.argv[1]
    context_json = sys.argv[2]
    context = json.loads(context_json)

    result = get_assert(output_code, context)
    print(json.dumps(result))
