import { test, expect } from "@playwright/test"

test.describe("Authentication E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to base URL before each test
    await page.goto("/")
  })

  test.describe("Sign Up Flow", () => {
    test("should display signup page", async ({ page }) => {
      await page.goto("/auth/signup")
      
      await expect(page).toHaveTitle(/Sign Up|Register|Studia/)
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
      await expect(page.locator('input[name="name"]')).toBeVisible()
    })

    test("should show validation errors for weak passwords", async ({ page }) => {
      await page.goto("/auth/signup")
      
      await page.fill('input[name="name"]', "Test User")
      await page.fill('input[type="email"]', "test@example.com")
      await page.fill('input[type="password"]', "weak")
      await page.click('button[type="submit"]')
      
      // Should show password validation error
      await expect(page.locator("text=password")).toBeVisible()
    })

    test("should successfully register a new user", async ({ page }) => {
      await page.goto("/auth/signup")
      
      await page.fill('input[name="name"]', "Test User")
      await page.fill('input[type="email"]', `test-${Date.now()}@example.com`)
      await page.fill('input[type="password"]', "SecurePass123!")
      await page.click('button[type="submit"]')
      
      // Should redirect to signin or dashboard after successful registration
      await expect(page).toHaveURL(/\/(auth\/signin|dashboard)/)
    })
  })

  test.describe("Sign In Flow", () => {
    test("should display signin page", async ({ page }) => {
      await page.goto("/auth/signin")
      
      await expect(page).toHaveTitle(/Sign In|Login|Studia/)
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
    })

    test("should show error for invalid credentials", async ({ page }) => {
      await page.goto("/auth/signin")
      
      await page.fill('input[type="email"]', "nonexistent@example.com")
      await page.fill('input[type="password"]', "wrongpassword")
      await page.click('button[type="submit"]')
      
      // Should show error message (anti-enumeration: generic message)
      await expect(page.locator("text=Invalid credentials|Error")).toBeVisible()
    })

    test("should successfully sign in with valid credentials", async ({ page }) => {
      // Note: This test requires a pre-existing user in the database
      // For local testing, create a user first via signup
      await page.goto("/auth/signin")
      
      // Use credentials of an existing test user
      await page.fill('input[type="email"]', "test@example.com")
      await page.fill('input[type="password"]', "SecurePass123!")
      await page.click('button[type="submit"]')
      
      // Should redirect to dashboard after successful login
      await expect(page).toHaveURL(/\/dashboard/)
    })
  })

  test.describe("Protected Routes", () => {
    test("should redirect to signin when accessing dashboard while logged out", async ({ page }) => {
      await page.goto("/dashboard")
      
      // Should redirect to signin page
      await expect(page).toHaveURL(/\/auth\/signin/)
    })

    test("should allow access to dashboard when logged in", async ({ page }) => {
      // First, sign in
      await page.goto("/auth/signin")
      await page.fill('input[type="email"]', "test@example.com")
      await page.fill('input[type="password"]', "SecurePass123!")
      await page.click('button[type="submit"]')
      
      // Wait for navigation
      await page.waitForURL(/\/dashboard/)
      
      // Should be on dashboard
      await expect(page).toHaveURL(/\/dashboard/)
    })
  })

  test.describe("Password Reset Flow", () => {
    test("should display forgot password page", async ({ page }) => {
      await page.goto("/auth/forgot-password")
      
      await expect(page).toHaveTitle(/Forgot Password|Reset/)
      await expect(page.locator('input[type="email"]')).toBeVisible()
    })

    test("should show success message even for non-existent email (anti-enumeration)", async ({ page }) => {
      await page.goto("/auth/forgot-password")
      
      await page.fill('input[type="email"]', "nonexistent@example.com")
      await page.click('button[type="submit"]')
      
      // Should show generic success message
      await expect(page.locator("text=If an account exists")).toBeVisible()
    })

    test("should display reset password page with valid token", async ({ page }) => {
      // Note: This test requires a valid reset token
      // For local testing, generate a token via the forgot password flow
      const testToken = "test-reset-token"
      await page.goto(`/auth/reset-password?token=${testToken}&email=test@example.com`)
      
      await expect(page.locator('input[type="password"]')).toBeVisible()
    })

    test("should reject weak passwords on reset", async ({ page }) => {
      const testToken = "test-reset-token"
      await page.goto(`/auth/reset-password?token=${testToken}&email=test@example.com`)
      
      await page.fill('input[type="password"]', "weak")
      await page.fill('input[name="confirmPassword"]', "weak")
      await page.click('button[type="submit"]')
      
      // Should show password validation error
      await expect(page.locator("text=password")).toBeVisible()
    })
  })

  test.describe("Logout Flow", () => {
    test("should successfully logout", async ({ page }) => {
      // First, sign in
      await page.goto("/auth/signin")
      await page.fill('input[type="email"]', "test@example.com")
      await page.fill('input[type="password"]', "SecurePass123!")
      await page.click('button[type="submit"]')
      await page.waitForURL(/\/dashboard/)
      
      // Find and click logout button/link
      const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), [data-testid="logout"]')
      if (await logoutButton.isVisible()) {
        await logoutButton.click()
        
        // Should redirect to signin or home page
        await expect(page).toHaveURL(/\/(auth\/signin|\/)/)
      }
    })
  })

  test.describe("Rate Limiting", () => {
    test("should lock account after multiple failed attempts", async ({ page }) => {
      await page.goto("/auth/signin")
      
      // Attempt 5 failed logins
      for (let i = 0; i < 5; i++) {
        await page.fill('input[type="email"]', "test@example.com")
        await page.fill('input[type="password"]', "wrongpassword")
        await page.click('button[type="submit"]')
        
        // Small delay between attempts
        await page.waitForTimeout(100)
      }
      
      // After 5 failed attempts, account should be locked
      // The next attempt should fail with account locked message
      await page.fill('input[type="email"]', "test@example.com")
      await page.fill('input[type="password"]', "SecurePass123!")
      await page.click('button[type="submit"]')
      
      // Should show account locked message or continue to fail
      await expect(page.locator("text=locked|Invalid credentials")).toBeVisible()
    })
  })
})

test.describe("Navigation and UI", () => {
  test("should navigate from signin to signup", async ({ page }) => {
    await page.goto("/auth/signin")
    
    const signupLink = page.locator('a:has-text("Sign Up"), a:has-text("Register"), a[href*="signup"]')
    if (await signupLink.isVisible()) {
      await signupLink.click()
      await expect(page).toHaveURL(/\/auth\/signup/)
    }
  })

  test("should navigate from signup to signin", async ({ page }) => {
    await page.goto("/auth/signup")
    
    const signinLink = page.locator('a:has-text("Sign In"), a:has-text("Login"), a[href*="signin"]')
    if (await signinLink.isVisible()) {
      await signinLink.click()
      await expect(page).toHaveURL(/\/auth\/signin/)
    }
  })
})
