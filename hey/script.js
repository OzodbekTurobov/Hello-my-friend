// Jump to a screen and prototype, without having to wait for flow
const Simulations = {
    localStorageError() {
      return false // Make this true to see the error screens
    },
  
    // This one is a sub-scenario of the one above
    deadEndError() {
      return Simulations.localStorageError() && true
    },
  
    // Maybe false, maybe a view
    workingOnView() {
      return false && Views.something()
    }
  }
  
  // Used in flow decision points
  const Constants = {
    DELETE: 'delete a progress',
    SOMETHING: 'a thing',
    LOCALSTORAGE_ERROR:
      `<p>Cannot access localStorage. Please make sure you have the localStorage / 3rd party cookies enabled and try again.</p>
      <p>If the error persists, please feel free to <a target="_blank" href="https://codepen.io/pavlovsk/details/poZwXmP">report it.</a></p>`,
    DEAD_END_ERROR:
      `Not a lucky day. Please refresh the page and try again.`
  }
  
  // Helpers
  const Utils = {
    sleep: async (durationMilliseconds) => {
      return new Promise(resolve => {
        return setTimeout(resolve, durationMilliseconds)
      })
    },
  
    branchOff: (srcFlow, subFlows) => async () => {
      const { key } = await srcFlow()
      return subFlows[key]()
    },
  
    toCSSText: (style) => {
      return Object.keys(style).reduce((acc, key) => {
        return `;
          ${acc};
          ${key}: ${style[key]};
        `
      }, ``)
    },
  
    pushStyle: (selector, styles) => {
      const el = document.querySelector(selector)
      const computedStyle = window.getComputedStyle(el)
      const originalStyle = Object.keys(styles).reduce((acc, key) => {
        return {
          ...acc,
          [key]: computedStyle[key]
        }
      }, {})
      const originalCSSText = Utils.toCSSText(originalStyle)
      el.style.cssText += Utils.toCSSText(styles)
      return originalCSSText
    }
  }
  
  // Side-effects
  const Actions = {
    async loadUserProgress() {
      await Utils.sleep(2000)
  
      if (Simulations.localStorageError()) {
        return Promise.resolve(Constants.LOCALSTORAGE_ERROR)
      }
  
      try {
        return window.localStorage.getItem('userProgress')
      } catch (e) {
        return Promise.resolve(Constants.LOCALSTORAGE_ERROR)
      }
    },
  
    async saveUserProgress() {
      await Utils.sleep(2000)
      try {
        return window.localStorage.setItem(
          'userProgress',
          JSON.stringify({some: 'data'})
        )
      } catch (e) {
        return Promise.resolve(Constants.LOCALSTORAGE_ERROR)
      }
    },
  
    async deleteUserProgress() {
      await Utils.sleep(2000)
      try {
        window.localStorage.removeItem('userProgress')
      } catch (e) {
        return Promise.resolve(Constants.LOCALSTORAGE_ERROR)
      }
      return Promise.resolve()
    },
  
    reloadPage() {
      try {
        if (Simulations.deadEndError()) {
          return Promise.resolve(Constants.DEAD_END_ERROR)
        }
        window.location.href = window.location.href
      } catch (e) {
        return Promise.resolve(Constants.DEAD_END_ERROR)
      }
    }
  }
  
  // All the ways the app can be in,
  // named and organized freely, using Promises
  const Flows = {
    master: async () => {
      if (Simulations.workingOnView()) {
        return Simulations.workingOnView()
      }
  
      const [ , progress ] = await Promise.all([
        Views.loading(),
        Actions.loadUserProgress()
      ])
      if (!progress) {
        return Flows.firstTime()
      }
      if (progress === Constants.LOCALSTORAGE_ERROR) {
        return Flows.abort(progress)
      }
      return Flows.continuation()
    },
  
    firstTime: async () => {
      if (Simulations.workingOnView()) {
        return Simulations.workingOnView()
      }
  
      await Views.intro1()
      await Views.intro2()
      await Views.intro3()
      await Views.intro4()
  
      await Promise.all([
        Views.saving(),
        Actions.saveUserProgress()
      ])
  
      return Flows.continuation()
    },
  
    // Switch flows based on which button in Views.main is clicked.
    continuation: Utils.branchOff(
      () => Views.main(),
      {
        async [Constants.SOMETHING]() {
          await Views.something()
          return Flows.continuation()
        },
  
        async [Constants.DELETE]() {
          await Promise.all([
            Views.deleting(),
            Actions.deleteUserProgress()
          ])
          return Flows.master()
        }
      }
    ),
  
    abort: async (progress) => {
      await Views.error(progress)
      const reloadError = await Actions.reloadPage()
      if (reloadError === Constants.DEAD_END_ERROR) {
        return Flows.deadEnd(reloadError)
      }
    },
  
    deadEnd: async (reason) => {
      await Views.deadEnd(reason)
    }
  }
  
  // Some low-level components that serve as a screen's layout
  const Layouts = {
    init(el) {
      this.el = el
    },
  
    async message({ content, enter, transitionDuration = 500 }) {
      const template = () => {
        return `
          <div class="layout message-layout">
            ${content}
          </form>
        `
      }
  
      const cssVariables = () => `;
        --transition-duration: ${transitionDuration};
      `
  
      if (typeof enter === 'function') {
        enter()
      }
      this.el.innerHTML = template()
      this.el.style.cssText += cssVariables()
      return new Promise()
    },
  
    async messageWithButtons({ content, btn, enter, exit, transitionDuration = 500 }) {
      const getBtn = (maybeMultipleBtns) => {
        if (Array.isArray(maybeMultipleBtns)) {
          return maybeMultipleBtns
        }
        return [maybeMultipleBtns]
      }
  
      const template = () => {
        return `
          <form id="complete-step-form" class="layout message-layout">
            ${content}
            <footer>
              ${getBtn(btn).map(eachBtn => `
                <button
                  autofocus
                  class="btn ${eachBtn.type || ''}"
                  data-key="${eachBtn.key || Constants.FORWARD}"
                >
                  ${eachBtn.text}
                </button>
              `).join('')}
            </footer>
          </form>
        `
      }
  
      const cssVariables = () => `;
        --transition-duration: ${transitionDuration};
      `
  
      const listenToFormSubmit = (onSubmit) => {
        const form = this.el.querySelector('#complete-step-form')
        form.addEventListener('submit', async e => {
          e.preventDefault()
          form.classList.add('exiting')
          if (typeof exit === 'function') {
            await exit(restoredValues)
          }
          setTimeout(() => {
            onSubmit({
              key: e.submitter.dataset.key
            })
          }, transitionDuration)
        })
      }
  
      let restoredValues
      if (typeof enter === 'function') {
        restoredValues = enter()
      }
      this.el.innerHTML = template()
      this.el.style.cssText += cssVariables()
      return new Promise(listenToFormSubmit)
    },
  
    async statusFeedback({ text, type, animationDuration = 1500 }) {
      const template = () => {
        const typeClassName = type || ''
        return `
          <div class="layout status-feedback-layout">
            <span class="animation-object ${type}"></span>
            <span class="status-text ${type}">${text}</span>
          </div>
        `
      }
  
      const cssVariables = () => `;
        --animation-duration: ${animationDuration}ms;
        --type: ${type};
      `
  
      const listenToAnimationEnd = (onEnd) => {
        setTimeout(onEnd, animationDuration)
      }   
  
      this.el.innerHTML = template()
      this.el.style.cssText += cssVariables()
      await new Promise(listenToAnimationEnd)
    },
  }
  
  // Things to render on the screen
  const Views = {
    async loading() {
      return Layouts.statusFeedback({
        text: 'loading',
        type: 'loading'
      })
    },
  
    async saving() {
      return Layouts.statusFeedback({
        text: 'saving',
        type: 'saving'
      })
    },
  
    async deleting() {
      return Layouts.statusFeedback({
        text: 'deleting',
        type: 'deleting'
      })
    },
  
    async intro1() {
      return Layouts.messageWithButtons({
        content: `
          <h1>Hello,</h1>
          <p>You seem to be here for the first time.</p>
        `,
        btn: {
          text: "Let's start!"
        }
      })
    },
  
    async intro2() {
      return Layouts.messageWithButtons({
        content: `
          <h1>Promises</h1>
          <p>In this demo, I'm using promises for chaining and transitioning between views.</p>
        `,
        btn: {
          text: 'What else?'
        }
      })
    },
  
    async intro3() {
      return Layouts.messageWithButtons({
        content: `
          <h1>await View()</h1>
          <p>Views are <em>awaited</em> to unblock their future flow.</p>
          <p>UI transitions are ensured between every screen.</p>
        `,
        btn: {
          text: 'Such dimension'
        }
      })
    },
  
    async intro4() {
      return Layouts.messageWithButtons({
        content: `
          <h1>Let's get interactive</h1>
          <p>After this view, your progress will be saved.</p>
          <p>You'll switch to a <em>continuation flow</em>, from this <em>intro</em>.</p>
        `,
        btn: {
          text: "Save it"
        }
      })
    },
  
    async main() {
      return Layouts.messageWithButtons({
        content: `
          <h1>Continuity</h1>
          <p>Now, you have a <em>progress</em>. If you refresh the browser, I'll remember the progress.</p>
          <p>Alternatively:</p>
        `,
        btn: [{
          text: 'Delete progress',
          type: 'danger',
          key: Constants.DELETE
        }, {
          text: 'Something',
          type: 'neutral',
          key: Constants.SOMETHING
        }]
      })
    },
  
    async something() {
      return Layouts.messageWithButtons({
        get content() {
          const alt = `A photo of a tree that I look at, sometimes.
  
  Trees are wonderfully inspiring organisms and they have branches in all directions. Each branch has its own sub-branches, and at around the very tip of each sub-branch, a flower to reproduce. 
  
  But each tree, and in general, each plant is a different story. Trees are inspiring because you can model / think / visualise so many things in the form of a tree. A few examples: "family tree", "tree of life", "decision tree", "dependency tree", "DOM tree"... Maybe you can imagine the entire existence as a big, big tree.`
          return `
            <img
              src="https://assets.codepen.io/25387/kuu.jpeg"
              alt='${alt}'
              title='${alt}' />`
        },
        btn: {
          text: 'Go back',
          type: 'different'
        }
      })
    },
  
    async error(message) {
      return Layouts.messageWithButtons({
        enter() {
          return Utils.pushStyle('body', {
            background: 'linear-gradient(to bottom, violet, lightblue)',
            color: 'black',
            transition: 'all 0.5s'
          })
        },
        async exit(originalCSSText) {
          document.body.style.cssText += originalCSSText
          await Utils.sleep(500)
          return Promise.resolve()
        },
        content: `
          <h1>Error</h1>
          <p>${message}</p>
        `,
        btn: {
          text: 'Refresh page',
          type: 'absurd'
        }
      })
    },
  
    async deadEnd(reason) {
      return Layouts.message({
        enter() {
          return Utils.pushStyle('body', {
            background: `
              linear-gradient(135deg, white -60%, transparent 30%),
              linear-gradient(135deg, #fd3 50%, black 300%)
            `,
            color: 'black',
            transition: 'all 0.5s'
          })
        },
        content: `
          <h1>Dead end.</h1>
          <p>${reason}</p>
        `
      })
    }
  }
  
  // Layouts should recognize the container
  Layouts.init(document.getElementById('app'))
  
  // Init one of the flows
  Flows.master()