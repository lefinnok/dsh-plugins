/**
 * Source data for the curated ladder. `scripts/build-curated.mjs` runs every
 * reference solution against every test, fills in `expected`, checks the
 * visible examples, and emits `data/curated.js`.
 *
 * Tests are args-only on purpose: one trusted reference computes the expected
 * value, so authoring mistakes show up as a build failure instead of a bogus
 * hidden test.
 */

const md = (...lines) => lines.join('\n')

export const PROBLEMS = [
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    tags: ['Array', 'Hash Table'],
    pattern: 'Hash map lookup',
    order: 1,
    compare: 'unordered',
    statement: md(
      'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.',
      '',
      'Each input has exactly one solution, and you may not use the same element twice. Return the answer in any order.',
    ),
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] == 9, so return [0, 1].' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
      { input: 'nums = [3,3], target = 6', output: '[0,1]' },
    ],
    constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i], target <= 10^9', 'Exactly one valid answer exists.'],
    meta: {
      name: 'twoSum',
      params: [
        { name: 'nums', type: 'integer[]' },
        { name: 'target', type: 'integer' },
      ],
      return: { type: 'integer[]' },
    },
    starters: {
      python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        pass
`,
      javascript: `var twoSum = function(nums, target) {
    
};
`,
      cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        
    }
};
`,
    },
    hints: [
      'The brute-force check is every pair: O(n²). What are you re-scanning that you could remember instead?',
      'For each number x, the partner you need is target - x. Can you answer “have I seen x’s partner?” in O(1)?',
      'Walk once, store value → index in a hash map, and check for the needed partner before inserting the current value.',
    ],
    reference: {
      python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, value in enumerate(nums):
            need = target - value
            if need in seen:
                return [seen[need], i]
            seen[value] = i
        return []
`,
    },
    tests: {
      visible: [
        { args: [[2, 7, 11, 15], 9] },
        { args: [[3, 2, 4], 6] },
        { args: [[3, 3], 6] },
      ],
      hidden: [
        { args: [[-1, -2, -3, -4, -5], -8] },
        { args: [[0, 4, 3, 0], 0] },
        { args: [[1, 2], 3] },
        { args: [[1000000000, -1000000000, 5], 0] },
        { args: [[2, 5, 5, 11], 10] },
        { args: [[-3, 4, 3, 90], 0] },
        { args: [[1, 3, 4, 2], 6] },
        { args: [[0, 1, 2, 0], 0] },
      ],
    },
  },
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    tags: ['String', 'Stack'],
    pattern: 'Stack matching',
    order: 2,
    statement: md(
      'Given a string `s` containing only the characters `(`, `)`, `{`, `}`, `[` and `]`, determine whether the brackets are valid.',
      '',
      'A string is valid when every opening bracket is closed by the same type of bracket, brackets close in the correct order, and every closing bracket has a matching opening bracket.',
    ),
    examples: [
      { input: 's = "()"', output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
      { input: 's = "([])"', output: 'true' },
    ],
    constraints: ['1 <= s.length <= 10^4', 's consists only of the six bracket characters.'],
    meta: {
      name: 'isValid',
      params: [{ name: 's', type: 'string' }],
      return: { type: 'boolean' },
    },
    starters: {
      python: `class Solution:
    def isValid(self, s: str) -> bool:
        pass
`,
      javascript: `var isValid = function(s) {
    
};
`,
      cpp: `class Solution {
public:
    bool isValid(string s) {
        
    }
};
`,
    },
    hints: [
      'Read the string left to right. What do you still owe the future when you have seen an opening bracket?',
      'The most recent unclosed opening bracket must be the next one closed. Which data structure gives you “most recent” in O(1)?',
      'Push openings onto a stack; on a closing bracket, the stack top must be its partner. At the end the stack must be empty.',
    ],
    reference: {
      python: `class Solution:
    def isValid(self, s: str) -> bool:
        pairs = {')': '(', ']': '[', '}': '{'}
        stack = []
        for ch in s:
            if ch in '([{':
                stack.append(ch)
            elif not stack or stack.pop() != pairs[ch]:
                return False
        return not stack
`,
    },
    tests: {
      visible: [
        { args: ['()'] },
        { args: ['()[]{}'] },
        { args: ['(]'] },
        { args: ['([])'] },
      ],
      hidden: [
        { args: ['('] },
        { args: [']'] },
        { args: ['([)]'] },
        { args: ['{[]}'] },
        { args: ['(((((())))))'] },
        { args: ['(){}}{'] },
        { args: ['((('] },
        { args: ['([{}])'] },
        { args: ['{}[]()'] },
        { args: ['(([]){})'] },
        { args: ['['] },
      ],
    },
  },
  {
    slug: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'Easy',
    tags: ['Array', 'Greedy', 'Dynamic Programming'],
    pattern: 'Running minimum',
    order: 3,
    statement: md(
      'You are given an array `prices` where `prices[i]` is the price of a stock on day `i`.',
      '',
      'Choose one day to buy and a later day to sell. Return the maximum profit, or `0` if no profitable trade is possible.',
    ),
    examples: [
      { input: 'prices = [7,1,5,3,6,4]', output: '5', explanation: 'Buy on day 2 (price 1) and sell on day 5 (price 6): 6 - 1 = 5.' },
      { input: 'prices = [7,6,4,3,1]', output: '0', explanation: 'Prices only fall, so no trade is made.' },
    ],
    constraints: ['1 <= prices.length <= 10^5', '0 <= prices[i] <= 10^4'],
    meta: {
      name: 'maxProfit',
      params: [{ name: 'prices', type: 'integer[]' }],
      return: { type: 'integer' },
    },
    starters: {
      python: `class Solution:
    def maxProfit(self, prices: list[int]) -> int:
        pass
`,
      javascript: `var maxProfit = function(prices) {
    
};
`,
      cpp: `class Solution {
public:
    int maxProfit(vector<int>& prices) {
        
    }
};
`,
    },
    hints: [
      'You need a buy day and a later sell day. What is the only thing about the past that matters when you reach a given day?',
      'At each price, the best sale ending today uses the cheapest price seen so far. Track that minimum.',
      'One pass: keep min_price and best_profit. Update min_price, then best_profit = max(best_profit, price - min_price).',
    ],
    reference: {
      python: `class Solution:
    def maxProfit(self, prices: list[int]) -> int:
        best = 0
        low = prices[0]
        for price in prices[1:]:
            best = max(best, price - low)
            low = min(low, price)
        return best
`,
    },
    tests: {
      visible: [
        { args: [[7, 1, 5, 3, 6, 4]] },
        { args: [[7, 6, 4, 3, 1]] },
      ],
      hidden: [
        { args: [[1]] },
        { args: [[2, 4, 1]] },
        { args: [[1, 2]] },
        { args: [[3, 2, 6, 5, 0, 3]] },
        { args: [[2, 1, 2, 1, 0, 1, 2]] },
        { args: [[1, 2, 3, 4, 5]] },
        { args: [[5, 4, 3, 2, 1]] },
        { args: [[2, 1, 4, 5, 2, 7]] },
        { args: [[3, 3, 5, 0, 0, 3, 1, 4]] },
      ],
    },
  },
  {
    slug: 'valid-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    tags: ['String', 'Two Pointers'],
    pattern: 'Two pointers with filtering',
    order: 4,
    statement: md(
      'Given a string `s`, return `true` if it is a palindrome after converting uppercase letters to lowercase and removing all non-alphanumeric characters.',
    ),
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: 'true', explanation: 'After cleaning: "amanaplanacanalpanama", which is a palindrome.' },
      { input: 's = "race a car"', output: 'false', explanation: 'After cleaning: "raceacar", which is not a palindrome.' },
      { input: 's = " "', output: 'true', explanation: 'After removing spaces: "", which is a palindrome.' },
    ],
    constraints: ['1 <= s.length <= 2 * 10^5', 's consists of printable ASCII characters.'],
    meta: {
      name: 'isPalindrome',
      params: [{ name: 's', type: 'string' }],
      return: { type: 'boolean' },
    },
    starters: {
      python: `class Solution:
    def isPalindrome(self, s: str) -> bool:
        pass
`,
      javascript: `var isPalindrome = function(s) {
    
};
`,
      cpp: `class Solution {
public:
    bool isPalindrome(string s) {
        
    }
};
`,
    },
    hints: [
      'The cleaned string is compared from both ends. Can you do that without building a new string?',
      'Use two indices: move each past non-alphanumeric characters, then compare the lowercased characters.',
      'Loop while left < right, skip junk on both sides, compare lowercased characters, and advance both.',
    ],
    reference: {
      python: `class Solution:
    def isPalindrome(self, s: str) -> bool:
        left, right = 0, len(s) - 1
        while left < right:
            while left < right and not s[left].isalnum():
                left += 1
            while left < right and not s[right].isalnum():
                right -= 1
            if s[left].lower() != s[right].lower():
                return False
            left += 1
            right -= 1
        return True
`,
    },
    tests: {
      visible: [
        { args: ['A man, a plan, a canal: Panama'] },
        { args: ['race a car'] },
        { args: [' '] },
      ],
      hidden: [
        { args: ['0P'] },
        { args: ['ab_a'] },
        { args: ['Aa'] },
        { args: ['a.'] },
        { args: ['.,'] },
        { args: ['abcba'] },
        { args: ['1a2'] },
        { args: ['12.21'] },
        { args: ["No 'x' in Nixon"] },
      ],
    },
  },
  {
    slug: 'binary-search',
    title: 'Binary Search',
    difficulty: 'Easy',
    tags: ['Array', 'Binary Search'],
    pattern: 'Halving the search space',
    order: 5,
    statement: md(
      'Given a sorted array of distinct integers `nums` and a `target`, return the index of `target` if it exists, otherwise return `-1`.',
      '',
      'Your algorithm must run in `O(log n)` time.',
    ),
    examples: [
      { input: 'nums = [-1,0,3,5,9,12], target = 9', output: '4', explanation: '9 exists at index 4.' },
      { input: 'nums = [-1,0,3,5,9,12], target = 2', output: '-1', explanation: '2 is not in nums.' },
    ],
    constraints: ['1 <= nums.length <= 10^4', '-10^4 < nums[i], target < 10^4', 'All values in nums are unique and sorted ascending.'],
    meta: {
      name: 'search',
      params: [
        { name: 'nums', type: 'integer[]' },
        { name: 'target', type: 'integer' },
      ],
      return: { type: 'integer' },
    },
    starters: {
      python: `class Solution:
    def search(self, nums: list[int], target: int) -> int:
        pass
`,
      javascript: `var search = function(nums, target) {
    
};
`,
      cpp: `class Solution {
public:
    int search(vector<int>& nums, int target) {
        
    }
};
`,
    },
    hints: [
      'The array is sorted. What does the middle value tell you about which half can still contain the target?',
      'Maintain an inclusive range [lo, hi]. Compare target with nums[mid], then discard the half that cannot contain it.',
      'While lo <= hi: mid = lo + (hi - lo) // 2; return mid on equality; move lo or hi past mid.',
    ],
    reference: {
      python: `class Solution:
    def search(self, nums: list[int], target: int) -> int:
        lo, hi = 0, len(nums) - 1
        while lo <= hi:
            mid = lo + (hi - lo) // 2
            if nums[mid] == target:
                return mid
            if nums[mid] < target:
                lo = mid + 1
            else:
                hi = mid - 1
        return -1
`,
    },
    tests: {
      visible: [
        { args: [[-1, 0, 3, 5, 9, 12], 9] },
        { args: [[-1, 0, 3, 5, 9, 12], 2] },
      ],
      hidden: [
        { args: [[5], 5] },
        { args: [[5], -5] },
        { args: [[-10, -5, 0, 3, 9], -10] },
        { args: [[1, 2, 3, 4, 5, 6, 7, 8], 8] },
        { args: [[1, 3], 3] },
        { args: [[1, 3], 2] },
        { args: [[0, 1, 2, 3, 4, 5], 0] },
        { args: [[-1, 0, 1, 2], -2] },
        { args: [[2, 4, 6, 8, 10], 10] },
      ],
    },
  },
  {
    slug: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    tags: ['Array', 'Dynamic Programming', 'Divide and Conquer'],
    pattern: 'Kadane’s algorithm',
    order: 6,
    statement: md(
      'Given an integer array `nums`, find the contiguous subarray with the largest sum and return that sum.',
    ),
    examples: [
      { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: 'The subarray [4,-1,2,1] has the largest sum, 6.' },
      { input: 'nums = [1]', output: '1' },
      { input: 'nums = [5,4,-1,7,8]', output: '23' },
    ],
    constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
    meta: {
      name: 'maxSubArray',
      params: [{ name: 'nums', type: 'integer[]' }],
      return: { type: 'integer' },
    },
    starters: {
      python: `class Solution:
    def maxSubArray(self, nums: list[int]) -> int:
        pass
`,
      javascript: `var maxSubArray = function(nums) {
    
};
`,
      cpp: `class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        
    }
};
`,
    },
    hints: [
      'For the best subarray ending at index i, what are the only two choices?',
      'Either extend the best subarray ending at i-1, or start a new one at nums[i]. Keep the better sum and a global best.',
      'Kadane: cur = max(x, cur + x); best = max(best, cur). Initialize both with the first value.',
    ],
    reference: {
      python: `class Solution:
    def maxSubArray(self, nums: list[int]) -> int:
        cur = best = nums[0]
        for value in nums[1:]:
            cur = max(value, cur + value)
            best = max(best, cur)
        return best
`,
    },
    tests: {
      visible: [
        { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]] },
        { args: [[1]] },
        { args: [[5, 4, -1, 7, 8]] },
      ],
      hidden: [
        { args: [[-1]] },
        { args: [[-2, -1]] },
        { args: [[-2, -3, -1, -4]] },
        { args: [[1, 2, 3]] },
        { args: [[0, -1, 0]] },
        { args: [[-1, 0, -2]] },
        { args: [[8, -19, 5, -4, 20]] },
        { args: [[1, -1, 1, -1, 1]] },
        { args: [[2, -1, 2]] },
      ],
    },
  },
  {
    slug: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'Easy',
    tags: ['Math', 'Dynamic Programming', 'Memoization'],
    pattern: 'Linear recurrence',
    order: 7,
    statement: md(
      'You are climbing a staircase with `n` steps. Each move you can climb 1 or 2 steps. Return the number of distinct ways to reach the top.',
    ),
    examples: [
      { input: 'n = 2', output: '2', explanation: '1 + 1 or 2.' },
      { input: 'n = 3', output: '3', explanation: '1+1+1, 1+2, 2+1.' },
    ],
    constraints: ['1 <= n <= 45'],
    meta: {
      name: 'climbStairs',
      params: [{ name: 'n', type: 'integer' }],
      return: { type: 'integer' },
    },
    starters: {
      python: `class Solution:
    def climbStairs(self, n: int) -> int:
        pass
`,
      javascript: `var climbStairs = function(n) {
    
};
`,
      cpp: `class Solution {
public:
    int climbStairs(int n) {
        
    }
};
`,
    },
    hints: [
      'The last move is either 1 step or 2 steps. How does that split the problem into smaller versions?',
      'ways(n) = ways(n - 1) + ways(n - 2), with ways(1) = 1 and ways(2) = 2. You only need the previous two values.',
      'Iterate from 3 to n keeping two variables, or use the Fibonacci closed form. O(n) time, O(1) space.',
    ],
    reference: {
      python: `class Solution:
    def climbStairs(self, n: int) -> int:
        if n <= 2:
            return n
        a, b = 1, 2
        for _ in range(3, n + 1):
            a, b = b, a + b
        return b
`,
    },
    tests: {
      visible: [{ args: [2] }, { args: [3] }],
      hidden: [
        { args: [1] },
        { args: [4] },
        { args: [5] },
        { args: [10] },
        { args: [20] },
        { args: [30] },
        { args: [38] },
        { args: [45] },
      ],
    },
  },
  {
    slug: 'merge-intervals',
    title: 'Merge Intervals',
    difficulty: 'Medium',
    tags: ['Array', 'Sorting'],
    pattern: 'Sort and sweep',
    order: 8,
    statement: md(
      'Given an array of intervals where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals and return the non-overlapping intervals that cover all input intervals.',
      '',
      'Intervals that only touch at an endpoint overlap.',
    ),
    examples: [
      { input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]', explanation: '[1,3] and [2,6] overlap, so they become [1,6].' },
      { input: 'intervals = [[1,4],[4,5]]', output: '[[1,5]]' },
      { input: 'intervals = [[1,4],[0,4]]', output: '[[0,4]]' },
    ],
    constraints: ['1 <= intervals.length <= 10^4', 'intervals[i].length == 2', '0 <= start_i <= end_i <= 10^4'],
    meta: {
      name: 'merge',
      params: [{ name: 'intervals', type: 'integer[][]' }],
      return: { type: 'integer[][]' },
    },
    starters: {
      python: `class Solution:
    def merge(self, intervals: list[list[int]]) -> list[list[int]]:
        pass
`,
      javascript: `var merge = function(intervals) {
    
};
`,
      cpp: `class Solution {
public:
    vector<vector<int>> merge(vector<vector<int>>& intervals) {
        
    }
};
`,
    },
    hints: [
      'Overlap detection is easiest when intervals are ordered. What order removes the need to compare every pair?',
      'Sort by start. Then a new interval either starts after the last merged end (no overlap) or extends it.',
      'Sort, seed the output with the first interval, and for each next interval update the last end or append a new interval.',
    ],
    reference: {
      python: `class Solution:
    def merge(self, intervals: list[list[int]]) -> list[list[int]]:
        intervals = sorted(intervals, key=lambda x: x[0])
        merged = []
        for start, end in intervals:
            if not merged or start > merged[-1][1]:
                merged.append([start, end])
            else:
                merged[-1][1] = max(merged[-1][1], end)
        return merged
`,
    },
    tests: {
      visible: [
        { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]] },
        { args: [[[1, 4], [4, 5]]] },
        { args: [[[1, 4], [0, 4]]] },
      ],
      hidden: [
        { args: [[[1, 4], [2, 3]]] },
        { args: [[[1, 4], [0, 2], [3, 5]]] },
        { args: [[[1, 4], [5, 6]]] },
        { args: [[[1, 2]]] },
        { args: [[[2, 3], [4, 5], [6, 7], [8, 9], [1, 10]]] },
        { args: [[[1, 4], [2, 3], [4, 5]]] },
        { args: [[[1, 4], [0, 0]]] },
        { args: [[[1, 4], [0, 1]]] },
        { args: [[[1, 4], [2, 2]]] },
      ],
    },
  },
  {
    slug: 'product-of-array-except-self',
    title: 'Product of Array Except Self',
    difficulty: 'Medium',
    tags: ['Array', 'Prefix Sum'],
    pattern: 'Prefix and suffix products',
    order: 9,
    statement: md(
      'Given an integer array `nums`, return an array `answer` where `answer[i]` is the product of all elements of `nums` except `nums[i]`.',
      '',
      'Solve it without division and in `O(n)` time.',
    ),
    examples: [
      { input: 'nums = [1,2,3,4]', output: '[24,12,8,6]' },
      { input: 'nums = [-1,1,0,-3,3]', output: '[0,0,9,0,0]' },
    ],
    constraints: ['2 <= nums.length <= 10^5', '-30 <= nums[i] <= 30', 'The product of any prefix or suffix fits in a 32-bit integer.'],
    meta: {
      name: 'productExceptSelf',
      params: [{ name: 'nums', type: 'integer[]' }],
      return: { type: 'integer[]' },
    },
    starters: {
      python: `class Solution:
    def productExceptSelf(self, nums: list[int]) -> list[int]:
        pass
`,
      javascript: `var productExceptSelf = function(nums) {
    
};
`,
      cpp: `class Solution {
public:
    vector<int> productExceptSelf(vector<int>& nums) {
        
    }
};
`,
    },
    hints: [
      'answer[i] is (product of everything left of i) × (product of everything right of i).',
      'Compute prefix products in a forward pass and fold suffix products in a backward pass, so you do not need division.',
      'Store left products in the output, then walk right to left with a running suffix and multiply it into each slot.',
    ],
    reference: {
      python: `class Solution:
    def productExceptSelf(self, nums: list[int]) -> list[int]:
        n = len(nums)
        out = [1] * n
        prefix = 1
        for i, value in enumerate(nums):
            out[i] = prefix
            prefix *= value
        suffix = 1
        for i in range(n - 1, -1, -1):
            out[i] *= suffix
            suffix *= nums[i]
        return out
`,
    },
    tests: {
      visible: [
        { args: [[1, 2, 3, 4]] },
        { args: [[-1, 1, 0, -3, 3]] },
      ],
      hidden: [
        { args: [[2, 3]] },
        { args: [[1, 1]] },
        { args: [[0, 0]] },
        { args: [[1, 0]] },
        { args: [[0, 1, 2]] },
        { args: [[-1, -1]] },
        { args: [[1, 2, 0, 4]] },
        { args: [[5, 1, 2, 3]] },
        { args: [[2, 2, 2, 2]] },
      ],
    },
  },
  {
    slug: 'number-of-islands',
    title: 'Number of Islands',
    difficulty: 'Medium',
    tags: ['Array', 'Depth-First Search', 'Breadth-First Search', 'Union Find', 'Matrix'],
    pattern: 'Grid flood fill',
    order: 10,
    statement: md(
      "Given a 2D grid of `'1'` (land) and `'0'` (water), count the number of islands.",
      '',
      'An island is surrounded by water and is formed by connecting adjacent land cells horizontally or vertically. The grid edges are surrounded by water.',
    ),
    examples: [
      {
        input: 'grid = [["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]',
        output: '1',
      },
      {
        input: 'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]',
        output: '3',
      },
    ],
    constraints: ['m == grid.length', 'n == grid[i].length', '1 <= m, n <= 300', "grid[i][j] is '0' or '1'."],
    meta: {
      name: 'numIslands',
      params: [{ name: 'grid', type: 'character[][]' }],
      return: { type: 'integer' },
    },
    starters: {
      python: `class Solution:
    def numIslands(self, grid: list[list[str]]) -> int:
        pass
`,
      javascript: `var numIslands = function(grid) {
    
};
`,
      cpp: `class Solution {
public:
    int numIslands(vector<vector<char>>& grid) {
        
    }
};
`,
    },
    hints: [
      'When you find unvisited land, the whole connected component is one island. How do you visit the component exactly once?',
      'Flood fill with DFS or BFS from each unvisited land cell, marking cells as water or visited as you go.',
      'Loop over all cells; on a 1, increment the count and flood fill its four neighbors, mutating the grid to avoid a visited set.',
    ],
    reference: {
      python: `class Solution:
    def numIslands(self, grid: list[list[str]]) -> int:
        if not grid or not grid[0]:
            return 0
        rows, cols = len(grid), len(grid[0])
        count = 0

        def sink(r: int, c: int) -> None:
            if r < 0 or r >= rows or c < 0 or c >= cols or grid[r][c] != '1':
                return
            grid[r][c] = '0'
            sink(r + 1, c)
            sink(r - 1, c)
            sink(r, c + 1)
            sink(r, c - 1)

        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == '1':
                    count += 1
                    sink(r, c)
        return count
`,
    },
    tests: {
      visible: [
        { args: [[['1', '1', '1', '1', '0'], ['1', '1', '0', '1', '0'], ['1', '1', '0', '0', '0'], ['0', '0', '0', '0', '0']]] },
        { args: [[['1', '1', '0', '0', '0'], ['1', '1', '0', '0', '0'], ['0', '0', '1', '0', '0'], ['0', '0', '0', '1', '1']]] },
      ],
      hidden: [
        { args: [[['1']]] },
        { args: [[['0']]] },
        { args: [[['1', '0', '1']]] },
        { args: [[['1', '1'], ['1', '1']]] },
        { args: [[['1', '0'], ['0', '1']]] },
        { args: [[['1', '1', '1'], ['1', '0', '1'], ['1', '1', '1']]] },
        { args: [[['0', '0'], ['0', '0']]] },
        { args: [[['1', '1', '0', '1']]] },
      ],
    },
  },
  {
    slug: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    tags: ['Hash Table', 'String', 'Sliding Window'],
    pattern: 'Sliding window',
    order: 11,
    statement: md(
      'Given a string `s`, find the length of the longest substring without repeating characters.',
    ),
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc", with length 3.' },
      { input: 's = "bbbbb"', output: '1', explanation: 'The answer is "b", with length 1.' },
      { input: 's = "pwwkew"', output: '3', explanation: 'The answer is "wke", with length 3. Note that "pwke" is a subsequence, not a substring.' },
    ],
    constraints: ['0 <= s.length <= 5 * 10^4', 's consists of English letters, digits, symbols, and spaces.'],
    meta: {
      name: 'lengthOfLongestSubstring',
      params: [{ name: 's', type: 'string' }],
      return: { type: 'integer' },
    },
    starters: {
      python: `class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        pass
`,
      javascript: `var lengthOfLongestSubstring = function(s) {
    
};
`,
      cpp: `class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        
    }
};
`,
    },
    hints: [
      'Maintain a window that currently has no repeats. What must happen when the new character is already inside it?',
      'Move the left edge to just past the previous occurrence of the new character. A map from character to last index makes that O(1).',
      'Expand right one character at a time; if the character was seen at index ≥ left, set left = last + 1. Track the max window length.',
    ],
    reference: {
      python: `class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        last = {}
        left = 0
        best = 0
        for right, ch in enumerate(s):
            if ch in last and last[ch] >= left:
                left = last[ch] + 1
            last[ch] = right
            best = max(best, right - left + 1)
        return best
`,
    },
    tests: {
      visible: [{ args: ['abcabcbb'] }, { args: ['bbbbb'] }, { args: ['pwwkew'] }],
      hidden: [
        { args: [''] },
        { args: [' '] },
        { args: ['au'] },
        { args: ['dvdf'] },
        { args: ['abba'] },
        { args: ['tmmzuxt'] },
        { args: ['abcdef'] },
        { args: ['aab'] },
        { args: ['anviaj'] },
        { args: ['cdd'] },
      ],
    },
  },
  {
    slug: 'coin-change',
    title: 'Coin Change',
    difficulty: 'Medium',
    tags: ['Array', 'Dynamic Programming', 'Breadth-First Search'],
    pattern: 'Unbounded knapsack DP',
    order: 12,
    statement: md(
      'You are given an array `coins` of different coin denominations and an integer `amount`.',
      '',
      'Return the fewest number of coins needed to make up `amount`. If the amount cannot be made, return `-1`. You have an unlimited supply of each coin.',
    ),
    examples: [
      { input: 'coins = [1,2,5], amount = 11', output: '3', explanation: '11 = 5 + 5 + 1.' },
      { input: 'coins = [2], amount = 3', output: '-1' },
      { input: 'coins = [1], amount = 0', output: '0' },
    ],
    constraints: ['1 <= coins.length <= 12', '1 <= coins[i] <= 2^31 - 1', '0 <= amount <= 10^4'],
    meta: {
      name: 'coinChange',
      params: [
        { name: 'coins', type: 'integer[]' },
        { name: 'amount', type: 'integer' },
      ],
      return: { type: 'integer' },
    },
    starters: {
      python: `class Solution:
    def coinChange(self, coins: list[int], amount: int) -> int:
        pass
`,
      javascript: `var coinChange = function(coins, amount) {
    
};
`,
      cpp: `class Solution {
public:
    int coinChange(vector<int>& coins, int amount) {
        
    }
};
`,
    },
    hints: [
      'Think about the last coin used. If it is c, the remaining amount is amount - c and you need the best answer for that smaller amount.',
      'Let dp[a] be the fewest coins for amount a. Initialize dp[0] = 0 and the rest to “impossible”; try every coin for every amount.',
      'Bottom-up: for a in 1..amount, for c in coins with c <= a, dp[a] = min(dp[a], dp[a-c] + 1). Return -1 if dp[amount] is still impossible.',
    ],
    reference: {
      python: `class Solution:
    def coinChange(self, coins: list[int], amount: int) -> int:
        impossible = amount + 1
        dp = [impossible] * (amount + 1)
        dp[0] = 0
        for a in range(1, amount + 1):
            for coin in coins:
                if coin <= a:
                    dp[a] = min(dp[a], dp[a - coin] + 1)
        return -1 if dp[amount] == impossible else dp[amount]
`,
    },
    tests: {
      visible: [
        { args: [[1, 2, 5], 11] },
        { args: [[2], 3] },
        { args: [[1], 0] },
      ],
      hidden: [
        { args: [[1], 1] },
        { args: [[1], 2] },
        { args: [[2, 5, 10, 1], 27] },
        { args: [[2, 4, 6], 8] },
        { args: [[2, 4, 6], 7] },
        { args: [[186, 419, 83, 408], 6249] },
        { args: [[3, 7, 405, 436], 8839] },
        { args: [[5], 5] },
        { args: [[5], 3] },
        { args: [[1, 2147483647], 2] },
        { args: [[1, 2, 5], 100] },
      ],
    },
  },
]
