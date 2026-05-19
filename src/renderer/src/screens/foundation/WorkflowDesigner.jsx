import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import {
  GitBranch,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Save,
  Settings,
  Check,
  Filter,
} from 'lucide-react';

// ============================================================
// Constants
// ============================================================
const MODULES = ['Finance', 'Purchasing', 'Sales', 'HR'];
const CONDITION_FIELDS = ['Amount', 'Department', 'Branch', 'Document Type', 'User Role'];
const CONDITION_OPERATORS = ['>', '<', '>=', '<=', '=', 'contains', 'in'];
const CONNECTORS = ['AND', 'OR'];
const APPROVER_TYPES = [
  { value: 'specific_user', label: 'Specific User' },
  { value: 'role', label: 'Role' },
  { value: 'department_head', label: 'Department Head' },
  { value: 'cfo', label: 'CFO' },
  { value: 'ceo', label: 'CEO' },
];
const APPROVAL_MODES = [
  { value: 'any_one', label: 'Any One' },
  { value: 'all', label: 'All Must Approve' },
  { value: 'majority', label: 'Majority' },
];

// ============================================================
// Sub-components
// ============================================================

function ConditionBuilder({ conditions, onChange }) {
  const handleFieldChange = (idx, field) => {
    const next = [...conditions];
    next[idx] = { ...next[idx], field };
    onChange(next);
  };

  const handleOperatorChange = (idx, operator) => {
    const next = [...conditions];
    next[idx] = { ...next[idx], operator };
    onChange(next);
  };

  const handleValueChange = (idx, value) => {
    const next = [...conditions];
    next[idx] = { ...next[idx], value };
    onChange(next);
  };

  const handleConnectorChange = (idx, connector) => {
    const next = [...conditions];
    next[idx] = { ...next[idx], connector };
    onChange(next);
  };

  const handleRemove = (idx) => {
    const next = conditions.filter((_, i) => i !== idx);
    onChange(next);
  };

  const handleAdd = () => {
    onChange([
      ...conditions,
      { field: 'Amount', operator: '>', value: '', connector: 'AND' },
    ]);
  };

  return (
    <div className="space-y-2">
      {conditions.length === 0 ? (
        <div className="text-xs text-gray-400 italic py-2">
          No conditions — workflow applies to all records of this type
        </div>
      ) : (
        conditions.map((cond, idx) => (
          <div key={idx} className="flex flex-wrap items-center gap-2">
            {/* AND/OR prefix */}
            {idx > 0 && (
              <span className="flex items-center justify-center rounded-full bg-brand-100 px-3 py-0.5 text-[10px] font-bold text-brand-700 uppercase min-w-[40px]">
                {cond.connector || 'AND'}
              </span>
            )}
            {idx === 0 && (
              <span className="flex items-center justify-center rounded-full bg-gray-100 px-3 py-0.5 text-[10px] font-bold text-gray-600 uppercase min-w-[40px]">
                IF
              </span>
            )}

            {/* Field */}
            <select
              value={cond.field}
              onChange={(e) => handleFieldChange(idx, e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
            >
              {CONDITION_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* Operator */}
            <select
              value={cond.operator}
              onChange={(e) => handleOperatorChange(idx, e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-mono focus:border-brand-400 focus:outline-none"
            >
              {CONDITION_OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>

            {/* Value */}
            <input
              type="text"
              value={cond.value}
              onChange={(e) => handleValueChange(idx, e.target.value)}
              placeholder="value…"
              className="w-28 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
            />

            {/* Connector (between rows) */}
            {idx < conditions.length - 1 && (
              <select
                value={cond.connector || 'AND'}
                onChange={(e) => handleConnectorChange(idx, e.target.value)}
                className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-bold focus:border-brand-400 focus:outline-none"
              >
                {CONNECTORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Remove */}
            <button
              onClick={() => handleRemove(idx)}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
              title="Remove condition"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))
      )}

      <button
        onClick={handleAdd}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-brand-400 hover:text-brand-600"
      >
        <Plus size={13} />
        Add Condition
      </button>
    </div>
  );
}

ConditionBuilder.propTypes = {
  conditions: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
};

// ============================================================
// ApprovalStepCard
// ============================================================

function ApprovalStepCard({
  step,
  index,
  total,
  onDelete,
  onMoveUp,
  onMoveDown,
  onChange,
  users,
  roles,
}) {
  const handleFieldChange = (key, value) => {
    onChange(index, { ...step, [key]: value });
  };

  return (
    <div className="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-brand-300 transition-colors">
      <div className="flex items-start gap-3">
        {/* Step number badge */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
          {index + 1}
        </div>

        <div className="flex-1 space-y-3">
          {/* Approver Type */}
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-medium text-gray-500 uppercase w-24 shrink-0">
              Approver
            </label>
            <select
              value={step.approver_type || 'specific_user'}
              onChange={(e) =>
                handleFieldChange('approver_type', e.target.value)
              }
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none flex-1"
            >
              {APPROVER_TYPES.map((at) => (
                <option key={at.value} value={at.value}>
                  {at.label}
                </option>
              ))}
            </select>
          </div>

          {/* Approver selector (conditional) */}
          {(step.approver_type === 'specific_user' ||
            step.approver_type === 'role') && (
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-medium text-gray-500 uppercase w-24 shrink-0">
                {step.approver_type === 'specific_user' ? 'User' : 'Role'}
              </label>
              <select
                value={step.approver_id || ''}
                onChange={(e) =>
                  handleFieldChange('approver_id', e.target.value)
                }
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none flex-1"
              >
                <option value="">
                  Select{' '}
                  {step.approver_type === 'specific_user' ? 'User' : 'Role'}…
                </option>
                {(step.approver_type === 'specific_user' ? users : roles).map(
                  (item) => (
                    <option key={item.id} value={item.id}>
                      {item.full_name || item.username || item.role_name}
                    </option>
                  ),
                )}
              </select>
            </div>
          )}

          {/* Approval Mode */}
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-medium text-gray-500 uppercase w-24 shrink-0">
              Mode
            </label>
            <select
              value={step.mode || 'any_one'}
              onChange={(e) => handleFieldChange('mode', e.target.value)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none flex-1"
            >
              {APPROVAL_MODES.map((am) => (
                <option key={am.value} value={am.value}>
                  {am.label}
                </option>
              ))}
            </select>
          </div>

          {/* Escalation */}
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-medium text-gray-500 uppercase w-24 shrink-0">
              Escalation
            </label>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-gray-500">After</span>
              <input
                type="number"
                value={step.escalation_hours || ''}
                onChange={(e) =>
                  handleFieldChange(
                    'escalation_hours',
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                placeholder="0"
                className="w-16 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
              />
              <span className="text-xs text-gray-500">hours → escalate to</span>
              <select
                value={step.escalate_to_type || 'specific_user'}
                onChange={(e) =>
                  handleFieldChange('escalate_to_type', e.target.value)
                }
                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
              >
                {APPROVER_TYPES.map((at) => (
                  <option key={at.value} value={at.value}>
                    {at.label}
                  </option>
                ))}
              </select>
              {(step.escalate_to_type === 'specific_user' ||
                step.escalate_to_type === 'role') && (
                <select
                  value={step.escalate_to_id || ''}
                  onChange={(e) =>
                    handleFieldChange('escalate_to_id', e.target.value)
                  }
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:border-brand-400 focus:outline-none"
                >
                  <option value="">Select…</option>
                  {(step.escalate_to_type === 'specific_user' ? users : roles).map(
                    (item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name || item.username || item.role_name}
                      </option>
                    ),
                  )}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-20"
            title="Move up"
          >
            <ChevronUp size={15} />
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={index >= total - 1}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-20"
            title="Move down"
          >
            <ChevronDown size={15} />
          </button>
          <button
            onClick={() => onDelete(index)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
            title="Delete step"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Drag handle */}
        <div className="flex items-center text-gray-300 cursor-grab active:cursor-grabbing shrink-0">
          <GripVertical size={16} />
        </div>
      </div>
    </div>
  );
}

ApprovalStepCard.propTypes = {
  step: PropTypes.shape({
    approver_type: PropTypes.string,
    approver_id: PropTypes.string,
    mode: PropTypes.string,
    escalation_hours: PropTypes.number,
    escalate_to_type: PropTypes.string,
    escalate_to_id: PropTypes.string,
  }).isRequired,
  index: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  onDelete: PropTypes.func.isRequired,
  onMoveUp: PropTypes.func.isRequired,
  onMoveDown: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  users: PropTypes.array.isRequired,
  roles: PropTypes.array.isRequired,
};

// ============================================================
// Main Component
// ============================================================
export default function WorkflowDesigner() {
  const { company } = useAuthStore();

  // --- Data ---
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);

  // --- Approvers cache ---
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  // --- Form state ---
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [module, setModule] = useState('Finance');
  const [trigger, setTrigger] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [conditions, setConditions] = useState([]);
  const [steps, setSteps] = useState([]);
  const [saving, setSaving] = useState(false);

  // Track if we're editing existing
  const isEditing = selectedWorkflowId !== null;

  // ============================================================
  // Load workflows
  // ============================================================
  const loadWorkflows = useCallback(() => {
    if (!company) return;
    setLoading(true);
    window.electronAPI
      .workflowList({ companyId: company.id })
      .then((res) => {
        if (res.success) {
          setWorkflows(res.data || []);
        } else {
          toast.error(res.error || 'Failed to load workflows');
        }
      })
      .catch(() => toast.error('Connection error'))
      .finally(() => setLoading(false));
  }, [company]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // ============================================================
  // Load approvers (users + roles)
  // ============================================================
  const loadApprovers = useCallback(async () => {
    if (!company) return;
    try {
      const res = await window.electronAPI.workflowGetApprovers({
        companyId: company.id,
      });
      if (res.success) {
        setUsers(res.data.users || []);
        setRoles(res.data.roles || []);
      }
    } catch {
      // silent
    }
  }, [company]);

  useEffect(() => {
    loadApprovers();
  }, [loadApprovers]);

  // ============================================================
  // Reset form
  // ============================================================
  const resetForm = () => {
    setName('');
    setDescription('');
    setModule('Finance');
    setTrigger('');
    setIsActive(true);
    setConditions([]);
    setSteps([]);
    setSelectedWorkflowId(null);
  };

  // ============================================================
  // Load workflow into form
  // ============================================================
  const handleSelectWorkflow = (wf) => {
    setSelectedWorkflowId(wf.id);
    setName(wf.name || '');
    setDescription(wf.description || '');
    setModule(wf.module || 'Finance');
    setTrigger(wf.trigger || '');
    setIsActive(wf.is_active !== false);
    setConditions(wf.conditions || []);
    setSteps(wf.steps || []);
  };

  // ============================================================
  // Step manipulation
  // ============================================================
  const handleAddStep = () => {
    setSteps([
      ...steps,
      {
        order: steps.length + 1,
        approver_type: 'specific_user',
        approver_id: '',
        mode: 'any_one',
        escalation_hours: null,
        escalate_to_type: 'specific_user',
        escalate_to_id: '',
      },
    ]);
  };

  const handleDeleteStep = (idx) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const handleMoveStepUp = (idx) => {
    if (idx <= 0) return;
    const next = [...steps];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setSteps(next);
  };

  const handleMoveStepDown = (idx) => {
    if (idx >= steps.length - 1) return;
    const next = [...steps];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setSteps(next);
  };

  const handleStepChange = (idx, updatedStep) => {
    const next = [...steps];
    next[idx] = updatedStep;
    setSteps(next);
  };

  // ============================================================
  // Save / Delete workflow
  // ============================================================
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Workflow name is required');
      return;
    }
    if (steps.length === 0) {
      toast.error('Add at least one approval step');
      return;
    }

    setSaving(true);
    const payload = {
      id: selectedWorkflowId || undefined,
      companyId: company.id,
      name: name.trim(),
      description: description.trim(),
      module,
      trigger,
      is_active: isActive,
      conditions,
      steps: steps.map((s, idx) => ({ ...s, order: idx + 1 })),
    };

    try {
      const res = await window.electronAPI.workflowSave(payload);
      if (res.success) {
        toast.success(isEditing ? 'Workflow updated' : 'Workflow created');
        loadWorkflows();
        if (!isEditing) {
          resetForm();
        }
      } else {
        toast.error(res.error || 'Failed to save workflow');
      }
    } catch {
      toast.error('Connection error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkflow = async (wfId) => {
    if (!window.confirm('Delete this workflow permanently?')) return;
    try {
      const res = await window.electronAPI.workflowDelete({ workflowId: wfId });
      if (res.success) {
        toast.success('Workflow deleted');
        if (selectedWorkflowId === wfId) resetForm();
        loadWorkflows();
      } else {
        toast.error(res.error || 'Failed to delete workflow');
      }
    } catch {
      toast.error('Connection error');
    }
  };

  // ============================================================
  // Filter workflows by module for grouping
  // ============================================================
  const workflowsByModule = {};
  for (const m of MODULES) {
    workflowsByModule[m] = workflows.filter((w) => w.module === m);
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="flex h-full">
      {/* ===== LEFT PANEL: workflow list ===== */}
      <div className="flex w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <GitBranch size={16} className="text-brand-500" />
            Workflows
          </h2>
          <button
            onClick={resetForm}
            className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
          >
            <Plus size={13} />
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            </div>
          ) : (
            MODULES.map((mod) => {
              const items = workflowsByModule[mod] || [];
              return (
                <div key={mod}>
                  <div className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                    {mod}
                  </div>
                  {items.length === 0 ? (
                    <p className="px-4 py-1 text-xs text-gray-300 italic">
                      No workflows
                    </p>
                  ) : (
                    items.map((wf) => (
                      <div
                        key={wf.id}
                        onClick={() => handleSelectWorkflow(wf)}
                        className={`group flex items-center justify-between px-4 py-2.5 cursor-pointer border-l-2 transition-colors ${
                          selectedWorkflowId === wf.id
                            ? 'border-brand-600 bg-brand-50'
                            : 'border-transparent hover:bg-gray-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-sm truncate ${
                              selectedWorkflowId === wf.id
                                ? 'font-semibold text-brand-800'
                                : 'font-medium text-gray-700'
                            }`}
                          >
                            {wf.name}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {wf.trigger || 'No trigger'} · {wf.steps?.length || 0} step(s)
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWorkflow(wf.id);
                          }}
                          className="rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              );
            })
          )}

          {!loading && workflows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Settings size={32} className="mb-2" />
              <p className="text-xs">No workflows defined</p>
              <p className="mt-0.5 text-[10px]">Click &ldquo;New&rdquo; to create one</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== RIGHT PANEL: editor ===== */}
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
        {!isEditing && !name && !description ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <GitBranch size={48} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">Workflow Designer</p>
            <p className="mt-1 text-xs">
              Select an existing workflow or create a new one
            </p>
          </div>
        ) : (
          <>
            {/* Scrollable editor body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section: Header */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Settings size={15} className="text-brand-500" />
                  Workflow Header
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase">
                      Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Approval workflow name…"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase">
                      Module
                    </label>
                    <select
                      value={module}
                      onChange={(e) => setModule(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                    >
                      {MODULES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase">
                      Description
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description…"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-gray-500 uppercase">
                      Trigger Document Type
                    </label>
                    <input
                      type="text"
                      value={trigger}
                      onChange={(e) => setTrigger(e.target.value)}
                      placeholder="e.g., PurchaseOrder, ExpenseReport…"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                      <span className="text-sm text-gray-700">
                        <Check size={14} className="inline mr-1 text-green-500" />
                        Active
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Section: Conditions */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Filter size={15} className="text-brand-500" />
                  Conditions
                </h3>
                <ConditionBuilder
                  conditions={conditions}
                  onChange={setConditions}
                />
              </div>

              {/* Section: Approval Steps */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <GitBranch size={15} className="text-brand-500" />
                    Approval Steps
                  </h3>
                  <button
                    onClick={handleAddStep}
                    className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    <Plus size={13} />
                    Add Step
                  </button>
                </div>

                {steps.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-400 italic">
                    No approval steps defined. Click &ldquo;Add Step&rdquo; to begin.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {steps.map((step, idx) => (
                      <ApprovalStepCard
                        key={idx}
                        step={step}
                        index={idx}
                        total={steps.length}
                        onDelete={handleDeleteStep}
                        onMoveUp={handleMoveStepUp}
                        onMoveDown={handleMoveStepDown}
                        onChange={handleStepChange}
                        users={users}
                        roles={roles}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom bar: Save */}
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3 shrink-0">
              <p className="text-xs text-gray-400">
                {isEditing ? 'Editing existing workflow' : 'Creating new workflow'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetForm}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Save size={15} />
                  )}
                  {isEditing ? 'Update Workflow' : 'Save Workflow'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}