# 恢复 ego lite 全部最小化窗口（v2：枚举进程所有顶层窗口，而非仅 MainWindowHandle）
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class WinRestore {
  public delegate bool EnumCb(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumCb cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
"@
$egoIds = (Get-Process -Name 'ego' -ErrorAction SilentlyContinue).Id
if (-not $egoIds) { Write-Host 'no ego process'; exit 1 }
$found = 0; $restored = 0
$cb = [WinRestore+EnumCb]{
  param($h, $l)
  $pid2 = 0
  [WinRestore]::GetWindowThreadProcessId($h, [ref]$pid2) | Out-Null
  if ($egoIds -contains [int]$pid2) {
    $sb = New-Object System.Text.StringBuilder 256
    [WinRestore]::GetWindowText($h, $sb, 256) | Out-Null
    $title = $sb.ToString()
    if ([WinRestore]::IsWindowVisible($h)) {
      $script:found++
      if ([WinRestore]::IsIconic($h)) {
        [WinRestore]::ShowWindow($h, 9) | Out-Null   # SW_RESTORE
        $script:restored++
        Write-Host ("restored: " + $title.Substring(0, [Math]::Min(50, $title.Length)))
      }
    }
  }
  $true
}
[WinRestore]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
Write-Host ("visible windows: $found, restored: $restored")
