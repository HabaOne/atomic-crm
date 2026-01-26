# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e7]:
      - img "Atomic CRM" [ref=e8]
      - text: Atomic CRM
    - generic [ref=e10]:
      - heading "Sign in" [level=1] [ref=e12]
      - generic [ref=e13]:
        - group [ref=e14]:
          - generic [ref=e16]: Email *
          - textbox "Email" [ref=e17]
        - group [ref=e18]:
          - generic [ref=e20]: Password *
          - textbox "Password" [ref=e21]
        - button "Sign in" [ref=e22] [cursor=pointer]
      - link "Forgot your password?" [ref=e23] [cursor=pointer]:
        - /url: "#/forgot-password"
  - region "Notifications alt+T"
```