Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'ego' } | ForEach-Object {
  Write-Host "$($_.ProcessName) : $($_.MainWindowTitle)"
  [Win]::ShowWindow($_.MainWindowHandle, 9) | Out-Null
  [Win]::SetForegroundWindow($_.MainWindowHandle) | Out-Null
}
