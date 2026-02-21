# Agent Box User Guide

## What is Agent Box?

**Agent Box** is your personal automation engine - think of it as "Zapier for Healthcare, but 100% local and HIPAA-compliant." It lets you create powerful workflows that connect different parts of your healthcare system without writing any code.

### Key Features

✅ **Natural Language Setup** - Describe what you want in plain English  
✅ **100% Local** - All data stays on your machine (HIPAA compliant)  
✅ **Time-Based Triggers** - Schedule tasks to run at specific times  
✅ **Event-Based Triggers** - React automatically when new data appears  
✅ **Multi-Step Workflows** - Chain multiple actions together  
✅ **Real-Time Monitoring** - Watch your automations run in the Debug Console  

---

## Getting Started

### Step 1: Connect Your MCP Tools

Before creating automations, you need to connect the tools (MCP servers) that Agent Box will use.

1. **Click the "Connect Tool" button** in the top-right corner
2. **Browse and select your MCP server** (e.g., Lab Testing System, Patient Records)
3. **Click "Connect"** - The tool will appear in your connected list
4. **Repeat** for all tools you want to automate

**Example Tools:**
- Lab Testing System (LTS) - For lab orders and results
- Patient Records - For patient data
- Email/Notifications - For sending alerts
- Staff Allocation - For scheduling

---

### Step 2: Open Agent Box

1. **Look at the left sidebar** (where Settings is)
2. **Click "Automations"** button (just above Settings)
3. **Agent Box modal opens** with two tabs:
   - **Rules** - Create and manage your automations
   - **Debug Console** - View real-time execution logs

---

## Creating Your First Automation

### Option A: Using Natural Language (Recommended)

1. **Click "New Rule (AI)"** button
2. **Describe what you want** in plain English

**Example Descriptions:**

```
"Every morning at 8:30 AM, create a lab test order for patient John Doe"

"When a new critical lab result comes in, send me an email notification"

"Every hour, check for pending lab orders and log them"

"At 5 PM daily, generate a summary of today's lab tests"
```

3. **Click "Generate Blueprint"** - AI creates the automation for you
4. **Review the generated blueprint** (JSON structure)
5. **Click "Create Rule"** to save and activate it

### Option B: Manual JSON Entry (Advanced)

1. **Click "Manual Rule"** button
2. **Enter your automation blueprint** in JSON format
3. **Click "Create Rule"**

---

## Understanding Automation Types

### 🕐 Time-Based (CRON) Automations

These run at specific times you schedule.

**Use Cases:**
- Daily reports at 8 AM
- Hourly data checks
- Weekly summaries
- End-of-day cleanup tasks

**Example:**
```
"Every morning at 8:30 AM, create a new lab test"
```

**CRON Expression:** `30 8 * * *` (8:30 AM daily)

### 🔄 Event-Based (Polling) Automations

These watch for new data and trigger automatically when something changes.

**Use Cases:**
- New lab results arrive
- Patient records updated
- Critical values detected
- New orders placed

**Example:**
```
"When a new lab result comes in, send me a notification"
```

**How it works:** Checks every X seconds for new data using a "cursor" (like an ID or timestamp)

---

## Managing Your Automations

### Viewing All Rules

In the **Rules** tab, you'll see all your automations with:

- **Name** - What the automation does
- **Description** - Details about the workflow
- **Type Badge** - 🕐 CRON or 🔄 Polling
- **Status** - ✓ success, ✗ failed, or ⋯ pending
- **Toggle Switch** - Enable/disable the rule
- **Delete Button** - Remove the rule

### Enabling/Disabling Rules

- **Toggle the switch** next to any rule
- **Green = Active** - Rule is running
- **Gray = Inactive** - Rule is paused

### Deleting Rules

1. **Click the trash icon** 🗑️ next to the rule
2. **Confirm deletion** in the popup
3. Rule is permanently removed

---

## Monitoring Automations

### Debug Console Tab

Switch to the **Debug Console** tab to see real-time logs:

**Log Colors:**
- 🟢 **Green** - Success messages
- 🔴 **Red** - Errors
- 🔵 **Cyan** - Trigger events (when automation fires)
- ⚪ **White** - Info messages
- ⚫ **Gray** - Debug details

**What You'll See:**
```
[10:30:45] [TRIGGER] [SCHEDULER] CRON triggered for rule abc123
[10:30:46] [SUCCESS] [EXECUTOR] Step completed: create_lab_test
[10:30:46] [SUCCESS] [SCHEDULER] Rule abc123 executed successfully
```

**Clear Button:** Clears the console (logs are not deleted, just hidden)

---

## Real-World Examples

### Example 1: Daily Lab Test Scheduler

**What it does:** Creates a lab test every day at 4:00 AM

**Natural Language:**
```
"Create a new lab test at 4:00 AM every day"
```

**Generated Blueprint:**
```json
{
  "name": "Daily Lab Test Scheduler",
  "description": "Create a new lab test at 4:00 AM every day",
  "trigger_type": "cron",
  "cron_expression": "0 4 * * *",
  "steps": [
    {
      "id": "step1",
      "type": "action",
      "mcp_server": "lts-mcp-server",
      "tool_name": "order_lab_test",
      "args_template": {
        "patient_id": "12345",
        "test_type": "CBC"
      }
    }
  ],
  "is_active": true
}
```

### Example 2: Critical Lab Alert

**What it does:** Monitors for critical lab results and sends alerts

**Natural Language:**
```
"When a lab result comes in with a value over 200, send me an alert"
```

**Generated Blueprint:**
```json
{
  "name": "Critical Lab Alert",
  "description": "Alert when lab values exceed threshold",
  "trigger_type": "event",
  "polling_config": {
    "mcp_server": "lts-mcp-server",
    "tool_name": "get_lab_results",
    "interval_seconds": 60,
    "cursor_field": "id"
  },
  "steps": [
    {
      "id": "step1",
      "type": "condition",
      "condition_rule": {
        ">=": [{"var": "trigger.value"}, 200]
      }
    },
    {
      "id": "step2",
      "type": "action",
      "mcp_server": "notification",
      "tool_name": "send_alert",
      "args_template": {
        "message": "Critical lab result: {{trigger.value}}"
      }
    }
  ],
  "is_active": true
}
```

### Example 3: Hourly Status Check

**What it does:** Checks for pending lab orders every hour

**Natural Language:**
```
"Every hour, list all pending lab orders"
```

**Generated Blueprint:**
```json
{
  "name": "Hourly Pending Orders Check",
  "description": "Check pending orders every hour",
  "trigger_type": "cron",
  "cron_expression": "0 * * * *",
  "steps": [
    {
      "id": "step1",
      "type": "action",
      "mcp_server": "lts-mcp-server",
      "tool_name": "list_pending_orders",
      "args_template": {}
    }
  ],
  "is_active": true
}
```

---

## Understanding CRON Expressions

CRON expressions define when time-based automations run.

**Format:** `minute hour day month weekday`

**Common Examples:**

| Expression | Meaning |
|------------|---------|
| `0 8 * * *` | Every day at 8:00 AM |
| `30 8 * * *` | Every day at 8:30 AM |
| `0 */2 * * *` | Every 2 hours |
| `0 9 * * 1` | Every Monday at 9:00 AM |
| `0 17 * * 1-5` | Weekdays at 5:00 PM |
| `*/15 * * * *` | Every 15 minutes |

**Quick Reference:**
- `*` = Every (any value)
- `*/X` = Every X units
- `X-Y` = Range from X to Y
- `X,Y,Z` = Specific values

---

## Troubleshooting

### Rule Not Triggering

**Check:**
1. ✅ Is the rule **enabled** (toggle switch is green)?
2. ✅ Are the **MCP tools connected**?
3. ✅ Is the **CRON expression valid**?
4. ✅ For polling: Is the **interval at least 10 seconds**?

**View Logs:**
- Switch to **Debug Console** tab
- Look for error messages in red
- Check if trigger events appear in cyan

### Rule Keeps Failing

**Auto-Disable Protection:**
- After **3 consecutive failures**, rules are automatically disabled
- You'll see a **⚠️ warning** with failure count
- Check the **Debug Console** for error details
- Fix the issue, then **re-enable** the rule

**Common Issues:**
- MCP tool disconnected
- Invalid arguments
- Network timeout
- Missing data in cursor field

### Blueprint Generation Failed

**If AI can't generate a blueprint:**
1. Make your description **more specific**
2. Mention the **exact tool names** you want to use
3. Try the **Manual Rule** option instead
4. Check that **MCP tools are connected**

---

## Best Practices

### 1. Start Simple
Begin with basic automations before creating complex multi-step workflows.

### 2. Test First
Create a rule, watch it run once in Debug Console, then enable it permanently.

### 3. Use Descriptive Names
Name your rules clearly so you remember what they do:
- ✅ "Daily 8AM Lab Test Creation"
- ❌ "Rule 1"

### 4. Monitor Regularly
Check the Debug Console occasionally to ensure rules are running smoothly.

### 5. Disable When Not Needed
Turn off rules you're not actively using to reduce system load.

### 6. Set Reasonable Intervals
For polling rules, don't set intervals too short (minimum 10 seconds):
- ✅ 60 seconds for most cases
- ✅ 300 seconds (5 min) for non-urgent checks
- ❌ 10 seconds (only for critical monitoring)

---

## Advanced Features

### Variable Injection

Use `{{variable}}` syntax to pass data between steps:

```json
{
  "steps": [
    {
      "id": "step1",
      "type": "action",
      "tool_name": "get_patient",
      "args_template": {"id": "12345"}
    },
    {
      "id": "step2",
      "type": "action",
      "tool_name": "send_email",
      "args_template": {
        "to": "{{step1.email}}",
        "subject": "Hello {{step1.name}}"
      }
    }
  ]
}
```

### Conditional Logic

Use JSON Logic for conditions:

```json
{
  "type": "condition",
  "condition_rule": {
    "and": [
      {">": [{"var": "trigger.value"}, 100]},
      {"<": [{"var": "trigger.value"}, 200]}
    ]
  }
}
```

**Common Operators:**
- `>`, `<`, `>=`, `<=` - Comparisons
- `==`, `!=` - Equality
- `and`, `or`, `!` - Logic
- `in` - Check if value in array

---

## Security & Privacy

### 100% Local Execution
- All automations run **on your machine**
- No data sent to external servers
- **HIPAA compliant** by design

### Data Storage
- Rules stored in **local RxDB database**
- Logs kept in **memory** (cleared on restart)
- No cloud sync or backup

### Access Control
- Only **you** can create/modify rules
- Rules run with **your permissions**
- MCP tools use **your credentials**

---

## Quick Reference Card

### Opening Agent Box
**Sidebar → Automations button** (above Settings)

### Creating a Rule
**Rules tab → New Rule (AI) → Describe → Generate → Create**

### Viewing Logs
**Debug Console tab** (real-time colored logs)

### Managing Rules
**Toggle switch** = Enable/Disable  
**Trash icon** = Delete  
**Status badge** = Last run result

### Getting Help
- Check **Debug Console** for errors
- Review this guide
- Test with simple rules first

---

## Summary

Agent Box transforms your healthcare workflows into automated processes that run reliably in the background. Whether you need daily reports, real-time alerts, or scheduled tasks, Agent Box handles it all while keeping your data 100% local and secure.

**Remember:**
1. Connect your MCP tools first
2. Start with simple automations
3. Monitor in Debug Console
4. Iterate and improve

Happy automating! 🚀
