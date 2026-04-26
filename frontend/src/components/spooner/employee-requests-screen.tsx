"use client"

import { useEffect, useMemo, useState } from "react"

import { approveMoveRequest } from "@/lib/backend-api"
import {
  listMoveRequests,
  type Employee,
  type MoveRequest,
  type MoveRequestApprovalStatus,
} from "@/lib/db-api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type EmployeeRequestsScreenProps = {
  employee: Employee
}

const activeStatuses = new Set(["pending", "accepted", "clarification_requested", "transition_started"])

export function EmployeeRequestsScreen({ employee }: EmployeeRequestsScreenProps) {
  const [requests, setRequests] = useState<MoveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingRequestId, setSavingRequestId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadRequests() {
      try {
        setIsLoading(true)
        setError(null)
        const nextRequests = await listMoveRequests()
        if (isMounted) {
          setRequests(nextRequests)
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load move requests."
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadRequests()

    return () => {
      isMounted = false
    }
  }, [])

  const employeeRequests = useMemo(
    () =>
      requests
        .filter((request) => request.employee_id === employee.id)
        .sort((left, right) => right.id - left.id),
    [employee.id, requests]
  )
  const activeRequests = employeeRequests.filter((request) =>
    activeStatuses.has(request.status)
  )
  const historicalRequests = employeeRequests.filter(
    (request) => !activeStatuses.has(request.status)
  )

  async function handleApproval(
    request: MoveRequest,
    approvalStatus: MoveRequestApprovalStatus
  ) {
    setSavingRequestId(request.id)
    setError(null)
    try {
      const updatedRequest = await approveMoveRequest(
        request.id,
        "employee",
        approvalStatus
      )
      setRequests((current) =>
        current.map((currentRequest) =>
          currentRequest.id === updatedRequest.id ? updatedRequest : currentRequest
        )
      )
    } catch (approvalError) {
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Unable to update move request."
      )
    } finally {
      setSavingRequestId(null)
    }
  }

  return (
    <div className="min-h-full bg-background">
      <div className="flex flex-col gap-5 p-4 sm:p-6">
        <header className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">
            Employee requests
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Review project move requests
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Approve CTO-generated move requests when you are ready to start the
            onboarding and offboarding handoff.
          </p>
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Move request error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="grid gap-3">
            <Skeleton className="h-36 rounded-3xl" />
            <Skeleton className="h-36 rounded-3xl" />
          </div>
        ) : activeRequests.length > 0 ? (
          <div className="grid gap-3">
            {activeRequests.map((request) => (
              <MoveRequestCard
                key={request.id}
                request={request}
                isSaving={savingRequestId === request.id}
                onApprove={() => handleApproval(request, "approved")}
                onReject={() => handleApproval(request, "rejected")}
              />
            ))}
          </div>
        ) : (
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>No active move requests</CardTitle>
              <CardDescription>
                New CTO-generated move requests will appear here for your
                approval.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {historicalRequests.length > 0 ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">History</h2>
              <p className="text-sm text-muted-foreground">
                Closed or rejected requests remain visible for context.
              </p>
            </div>
            <div className="grid gap-3">
              {historicalRequests.map((request) => (
                <MoveRequestCard key={request.id} request={request} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function MoveRequestCard({
  request,
  isSaving = false,
  onApprove,
  onReject,
}: {
  request: MoveRequest
  isSaving?: boolean
  onApprove?: () => void
  onReject?: () => void
}) {
  const canRespond =
    request.status !== "completed" &&
    request.status !== "rejected" &&
    request.status !== "transition_started" &&
    request.employee_approval_status !== "approved"

  return (
    <Card className="rounded-3xl">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>
              {request.from_project_name ?? "Current assignment"} to{" "}
              {request.to_project_name}
            </CardTitle>
            <CardDescription>{request.expected_role}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <RequestBadge label={formatStatus(request.status)} />
            <RequestBadge
              label={`CTO ${formatApproval(request.cto_approval_status)}`}
            />
            <RequestBadge
              label={`You ${formatApproval(request.employee_approval_status)}`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{request.reason}</p>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Fact label="Impact" value={request.current_project_impact} />
          <Fact label="Requested" value={formatDate(request.created_at)} />
          <Fact label="Last update" value={formatDate(request.responded_at)} />
        </div>
        {canRespond ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={isSaving} onClick={onApprove}>
              {isSaving ? "Saving..." : "Approve move"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSaving}
              onClick={onReject}
            >
              Reject
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {request.status === "transition_started"
              ? "Transition instructions are available in Onboarding and Offboarding."
              : "No action required."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/45 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium capitalize">{value}</p>
    </div>
  )
}

function RequestBadge({ label }: { label: string }) {
  return <Badge variant="secondary">{label}</Badge>
}

function formatStatus(status: MoveRequest["status"]) {
  const labels: Record<MoveRequest["status"], string> = {
    pending: "Pending",
    accepted: "Partially approved",
    rejected: "Rejected",
    clarification_requested: "Clarification requested",
    transition_started: "Transition started",
    completed: "Completed",
  }

  return labels[status]
}

function formatApproval(status: MoveRequestApprovalStatus) {
  if (status === "approved") return "approved"
  if (status === "rejected") return "rejected"
  return "pending"
}

function formatDate(value: string | null) {
  if (!value) return "Not yet"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
