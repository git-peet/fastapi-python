import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  type ConversationCreate,
  type ConversationPublic,
  ConversationsService,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const formSchema = z.object({
  title: z
    .string()
    .min(1, { message: "Title is required" })
    .max(255, { message: "Title must be 255 characters or fewer" }),
  transcript: z
    .string()
    .min(1, { message: "Transcript is required" })
    .max(10000, { message: "Transcript must be 10,000 characters or fewer" }),
})

type FormData = z.infer<typeof formSchema>

interface ConversationFormDialogProps {
  conversation?: ConversationPublic
  onSaved?: (conversation: ConversationPublic) => void
}

function ConversationFormDialog({
  conversation,
  onSaved,
}: ConversationFormDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const editing = conversation !== undefined

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      title: conversation?.title ?? "",
      transcript: conversation?.transcript ?? "",
    },
  })

  const { reset } = form
  useEffect(() => {
    if (isOpen) {
      reset({
        title: conversation?.title ?? "",
        transcript: conversation?.transcript ?? "",
      })
    }
  }, [conversation, isOpen, reset])

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (conversation) {
        const response = await ConversationsService.updateConversation({
          path: { id: conversation.id },
          body: data,
        })
        return response.data
      }
      const body: ConversationCreate = data
      const response = await ConversationsService.createConversation({ body })
      return response.data
    },
    onSuccess: (saved) => {
      showSuccessToast(
        editing
          ? "Conversation updated successfully"
          : "Conversation created successfully",
      )
      setIsOpen(false)
      form.reset({ title: saved.title, transcript: saved.transcript })
      onSaved?.(saved)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: ["conversations", user.id],
        })
      }
    },
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline">
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 size-4" />
            New Conversation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Conversation" : "New Conversation"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the title or transcript. Changing the transcript clears its previous triage."
              : "Add a title and transcript for a conversation you own."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={255}
                        autoComplete="off"
                        aria-describedby="conversation-title-limit"
                      />
                    </FormControl>
                    <p
                      id="conversation-title-limit"
                      className="text-xs text-muted-foreground"
                    >
                      Up to 255 characters.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="transcript"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transcript</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={8}
                        maxLength={10000}
                        aria-describedby="conversation-transcript-limit"
                        className="max-h-[50vh] resize-y"
                      />
                    </FormControl>
                    <p
                      id="conversation-transcript-limit"
                      className="text-xs text-muted-foreground"
                    >
                      Up to 10,000 characters. Only you can access this
                      conversation.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={mutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <LoadingButton type="submit" loading={mutation.isPending}>
                Save
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default ConversationFormDialog
