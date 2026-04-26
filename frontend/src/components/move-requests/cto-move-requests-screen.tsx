"use client"

import { useEffect, useMemo, useState } from "react"

import {
  listMoveRequests,
  type MoveRequest,
  type MoveRequestApprovalStatus,
} from "@/lib/db-api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CtoMoveRequestsScreenProps = {
  initialRequests?: MoveRequest[] | null
}

const currentStatuses = new Set<MoveRequest["status"]>([
  "pending",
  "accepted",
  "clarification_requested",
  "transition_started",
])

export function CtoMoveRequestsScreen({
  initialRequests,
}: CtoMoveRequestsScreenProps) {
  const [requests, setRequests] = useState<MoveRequest[]>(() => initialRequests ?? [])
  const [isLoading, setIsLoading] = useState(() => !initialRequests)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialRequests) {
      return
    }

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
  }, [initialRequests])

  const currentRequests = useMemo(
    () =>
      requests
        .filter((request) => currentStatuses.has(request.status))
        .sort((left, right) => right.id - left.id),
    [requests]
  )
  const metrics = useMemo(
    () => [
      {
        label: "Current requests",
        value: currentRequests.length,
      },
      {
        label: "Awaiting employee",
        value: currentRequests.filter(
          (request) => request.employee_approval_status === "pending"
        ).length,
      },
      {
        label: "Transitioning",
        value: currentRequests.filter(
          (request) => request.status === "transition_started"
        ).length,
      },
    ],
    [currentRequests]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 bg-background p-4 sm:p-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Move requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track CTO-created and matching-created move requests through approval
          and transition status.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Move request error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label} className="rounded-3xl">
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl">{isLoading ? "-" : metric.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="min-h-0 rounded-3xl">
        <CardHeader>
          <CardTitle>Current move requests</CardTitle>
          <CardDescription>
            Completed and rejected requests are kept out of this operational view.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : currentRequests.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Move</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approvals</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.employee_name}
                      </TableCell>
                      <TableCell>{formatMoveLabel(request)}</TableCell>
                      <TableCell>{request.expected_role}</TableCell>
                      <TableCell>
                        <RequestStatusBadge status={request.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <ApprovalBadge label="CTO" status={request.cto_approval_status} />
                          <ApprovalBadge
                            label="Employee"
                            status={request.employee_approval_status}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {request.current_project_impact}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(request.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <h2 className="font-semibold">No current move requests</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                New matching or employee-profile requests will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function formatMoveLabel(request: MoveRequest) {
  if (request.to_project_name === null) {
    return `${request.from_project_name ?? "Current assignment"} to offboarding`
  }

  return `${request.from_project_name ?? "Bench"} to ${request.to_project_name}`
}

function RequestStatusBadge({ status }: { status: MoveRequest["status"] }) {
  const labels: Record<MoveRequest["status"], string> = {
    pending: "Pending",
    accepted: "Partially approved",
    rejected: "Rejected",
    clarification_requested: "Clarification requested",
    transition_started: "Transition started",
    completed: "Completed",
  }

  return <Badge variant="secondary">{labels[status]}</Badge>
}

function ApprovalBadge({
  label,
  status,
}: {
  label: string
  status: MoveRequestApprovalStatus
}) {
  return (
    <Badge variant={status === "approved" ? "default" : "outline"}>
      {label} {status}
    </Badge>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
