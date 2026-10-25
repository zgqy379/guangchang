Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
# 按进程名匹配（窗口标题会随任务空间变化，不可靠）
Get-Process -Name 'ego' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object {
  Write-Host "$($_.ProcessName) : $($_.MainWindowTitle)"
  [Win]::ShowWindow($_.MainWindowHandle, 9) | Out-Null
  [Win]::SetForegroundWindow($_.MainWindowHandle) | Out-Null
}
