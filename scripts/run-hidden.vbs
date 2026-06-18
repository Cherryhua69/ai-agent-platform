Set shell = CreateObject("WScript.Shell")
Set environment = shell.Environment("PROCESS")
environment("AI_AGENT_HIDDEN_RUN") = "1"

command = ""
For index = 0 To WScript.Arguments.Count - 1
  command = command & " " & Quote(WScript.Arguments(index))
Next

shell.Run "%ComSpec% /d /c call" & command, 0, False

Function Quote(value)
  Quote = Chr(34) & Replace(value, Chr(34), Chr(34) & Chr(34)) & Chr(34)
End Function
